// genesis.js — unified "claim dev funds" flow over the WASM SDK.
//
// The Rust binding splits the claim into two calls because a browser
// Promise cannot hold the wallet's `&mut self` borrow across an await:
//
//   wallet.claimGenesisFund(transport, params) -> Promise<outcome>   (network)
//   wallet.commitGenesisFund(stateId, receipt, factChain)            (local, sync)
//
// `claimGenesis()` chains them so callers (the "Claim dev funds" button)
// see one async call. Every outbound payload is a typed-UMP WitnessRequest
// built in sdk-core (no hand-rolled CBOR); this file only sequences the
// two phases and converts the hex hand-off.
//
// params: {
//   amount,          // BigInt — atoms to claim
//   reference,       // string — e.g. "sdk"
//   offeredFee,      // BigInt — atoms (>= MIN_OFFERED_FEE)
//   validators,      // [{ validatorId: hex64, email }]   (TOT-supported only)
//   k,               // number — witnesses required (3 for genesis)
//   inboxNew,        // "maildir/inbox/new"
//   inboxCur,        // "maildir/inbox/cur"
//   pollIntervalMs,  // number — inbox poll backoff
//   pollMaxRounds,   // number — per-hop poll budget before timeout
//   nablaTcpAddresses, // string[] — Nabla "host:port" (via TOT /nabla/<n>)
//                      //   for the post-round register; [] skips register
// }

export async function claimGenesis(wallet, transport, params, onStep) {
  // Phase 1 — network: build the GenesisClaim TX, run CL1 locally, drive
  // the serial k-witness round over TOT. Does not touch wallet state.
  const outcome = await wallet.claimGenesisFund(transport, params, onStep || null);

  // Phase 2 — local: advance wallet state atomically (produced_state_id,
  // balance 0, wallet_seq 1, receipt + FACT chain) and persist.
  wallet.commitGenesisFund(
    hexToBytes(outcome.producedStateIdHex),
    outcome.receiptCbor,
    outcome.factChainCbor,
  );

  // Nabla register now runs INSIDE claimGenesisFund (after the witness
  // round) — outcome.registered reflects whether the txid landed in the
  // SMT. Pass params.nablaTcpAddresses to enable it.
  //
  // Phase 3 (still to wire): redeem the genesis cheque bundle to credit the
  // balance — the same path a normal receive uses (wallet.recv + redeem).
  return {
    txid: outcome.txidHex,
    producedStateId: outcome.producedStateIdHex,
    witnessCount: outcome.witnessCount,
    registered: outcome.registered,
    redeemed: false,
    balance: wallet.balance, // still 0 until redeem credits it
  };
}

// Redeem a stored cheque bundle: redeemFund (async/network) → commitRedeem
// (sync/local credit). Same fund→commit split rationale as claimGenesis.
// `redeemParams`: { validators, k, nablaTcpAddresses, inboxNew, inboxCur,
// pollIntervalMs, pollMaxRounds }. Returns the credited balance.
export async function redeem(wallet, transport, chequeId, redeemParams, onStep) {
  const before = wallet.balance; // BigInt — to compute the credited delta
  const outcome = await wallet.redeemFund(transport, chequeId, redeemParams, onStep || null);
  wallet.commitRedeem(
    hexToBytes(outcome.producedStateIdHex),
    outcome.newBalance,      // BigInt
    outcome.newWalletSeq,    // BigInt
    outcome.receiptCbor,
    outcome.factChainCbor,
    chequeId,
  );
  // Record the credit (covers both a genesis self-redeem and a normal
  // receive — one entry, no double-count with the fund phase).
  recordHistory(wallet, String(chequeId).split(':')[0], 'Redeem',
    outcome.newBalance - before, '', 'redeem', outcome.feeBreakdown || []);
  return {
    producedStateId: outcome.producedStateIdHex,
    newBalance: outcome.newBalance,
    registered: outcome.registered,
    balance: wallet.balance, // now credited
  };
}

// Full genesis dev-funds claim: claimGenesis (fund+register+commit) → poll
// the inbox until the self-send cheque arrives (caller runs kiddoReceiveCycle
// + wallet.recv on a timer) → redeem. This helper does the redeem tail once
// a ready bundle exists; the recv polling is the caller's loop.
export async function claimAndRedeem(wallet, transport, claimParams, redeemParams, chequeId) {
  await claimGenesis(wallet, transport, claimParams);
  return await redeem(wallet, transport, chequeId, redeemParams);
}

// Normal send: sendFund (async/network — build TX → CL1 → k-witness round
// over TOT → register) → commitSend (sync/local debit). `amountAtoms` is a
// BigInt; `params` = { validators, k, nablaTcpAddresses, inboxNew, inboxCur,
// pollIntervalMs, pollMaxRounds }. Returns the new (debited) balance.
export async function send(wallet, transport, to, amountAtoms, reference, params, onStep) {
  const o = await wallet.sendFund(transport, to, amountAtoms, reference, params, onStep || null);
  wallet.commitSend(
    hexToBytes(o.producedStateIdHex),
    o.newBalance,    // BigInt
    o.newWalletSeq,  // BigInt
    o.receiptCbor,
    o.factChainCbor,
  );
  recordHistory(wallet, o.txidHex, 'Send', amountAtoms, to, reference);
  return {
    txid: o.txidHex,
    newBalance: o.newBalance,
    registered: o.registered,
    balance: wallet.balance, // now debited
  };
}

// Heal / scar-burn: healFund (async/network — TX_HEAL re-anchor or scar
// burn, auto-selected from wallet state) → commitHeal (sync, clears CLARA
// state for TX_HEAL). `params` = same shape as send/redeem. Returns the
// new balance + whether CLARA state was cleared.
export async function heal(wallet, transport, params, onStep) {
  return await healLike(wallet, 'healFund', 'Heal', 'heal', transport, params, onStep);
}

// YPX-020 HAL — RE-ANCHOR a healthy wallet whose prior witnesses are
// unreachable (dead-overlap). halReanchorFund → commitHeal (which stamps the
// hibernation lock the produced state carries). Records a HalReanchor history
// row. After this the wallet is HIBERNATING (send/redeem rejected) until
// halComplete clears it.
export async function halReanchor(wallet, transport, params, onStep) {
  return await healLike(wallet, 'halReanchorFund', 'HalReanchor', 'hal-reanchor', transport, params, onStep);
}

// YPX-020 §2 HAL — COMPLETE recovery by REDEEMING the re-anchor's distress
// (dust self-) cheque. There is no halCompleteFund / separate completion
// self-send anymore: the redeem IS the completion. Core's CL5 zeroes
// hibernation_until in the witnessed receipt; commitRedeem doesn't touch the
// local flag, so we mirror the clear via wallet.clearHibernation(). The distress
// cheque lands in the inbox via the receive pump the caller runs — poll recv
// until it's ready, then redeem it (records ONE dust Redeem row, not a
// "HAL complete" row).
export async function halComplete(wallet, transport, params, onStep) {
  const maildir = (params.inboxNew || '').replace(/\/inbox\/new$/, '');
  const ownAddr = wallet.info().address;
  let chequeId = null;
  const rounds = params.pollMaxRounds || 720;
  for (let i = 0; i < rounds && !chequeId; i++) {
    if (onStep) onStep('recv');
    const cheques = wallet.recv(maildir) || [];
    // The distress cheque is a ready SELF-cheque (sender == this wallet);
    // fall back to any ready bundle if the address compare is finicky.
    const distress = cheques.find(c => c.ready && c.sender === ownAddr)
                  || cheques.find(c => c.ready);
    if (distress) { chequeId = distress.chequeId; break; }
    await sleep(params.pollIntervalMs || 250);
  }
  if (!chequeId) {
    throw new Error('Finish recovery: no distress cheque ready yet — re-anchor first, then wait for its dust cheque to arrive.');
  }
  const r = await redeem(wallet, transport, chequeId, params, onStep);
  wallet.clearHibernation();   // §2: mirror CL5's hibernation clear locally
  return { ...r, hibernationUntil: 0 };
}

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

// Shared body for heal / HAL re-anchor — both are key-proved validator-
// witnessed self-sends with no counterparty value, the same Fund → commitHeal
// shape. (HAL completion is NOT here — §2 makes it a redeem; see halComplete.)
// `fundFn` is the WASM method name, `histType`/`histRef` the History row labels.
async function healLike(wallet, fundFn, histType, histRef, transport, params, onStep) {
  const o = await wallet[fundFn](transport, params, onStep || null);
  wallet.commitHeal(
    hexToBytes(o.producedStateIdHex),
    o.newBalance,    // BigInt
    o.newWalletSeq,  // BigInt
    o.receiptCbor,
    o.factChainCbor,
    o.clearClara,
    o.hibernationUntil, // YPX-020: re-anchor stamps the lock; heal/complete clear it
  );
  // Self-send (no counterparty value transfer) — record amount 0 so the
  // History view renders it as "<label> —".
  recordHistory(wallet, o.txidHex, histType, 0n, '', histRef);
  return {
    txid: o.txidHex,
    newBalance: o.newBalance,
    registered: o.registered,
    clearClara: o.clearClara,
    hibernationUntil: o.hibernationUntil,
    balance: wallet.balance,
  };
}

// Append a TxRecord via the SDK so it persists to history.cbor and shows in
// the History tab. Best-effort: a history-write failure must never fail the
// (already-committed) protocol op.
function recordHistory(wallet, txid, type, amount, counterparty, reference, feeBreakdown = []) {
  try {
    wallet.appendHistory(
      String(txid || ''),
      type,
      BigInt(amount),
      counterparty || '',
      BigInt(Math.floor(Date.now() / 1000)),
      reference || null,
      feeBreakdown || [],
    );
  } catch (e) {
    console.warn('[axiom] history record failed', e);
  }
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

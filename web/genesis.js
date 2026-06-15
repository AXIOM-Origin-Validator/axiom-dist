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
  const o = await wallet.healFund(transport, params, onStep || null);
  wallet.commitHeal(
    hexToBytes(o.producedStateIdHex),
    o.newBalance,    // BigInt
    o.newWalletSeq,  // BigInt
    o.receiptCbor,
    o.factChainCbor,
    o.clearClara,
  );
  // Heal is a wallet-internal self-send (no counterparty value transfer) —
  // record it with amount 0 so the History view renders it as "Heal —".
  recordHistory(wallet, o.txidHex, 'Heal', 0n, '', 'heal');
  return {
    txid: o.txidHex,
    newBalance: o.newBalance,
    registered: o.registered,
    clearClara: o.clearClara,
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

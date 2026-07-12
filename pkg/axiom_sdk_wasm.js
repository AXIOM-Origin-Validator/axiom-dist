/* @ts-self-types="./axiom_sdk_wasm.d.ts" */

/**
 * JS-facing wallet handle. Holds the storage lock for its lifetime.
 * Call `close()` to persist and release.
 */
export class Wallet {
    static __wrap(ptr) {
        const obj = Object.create(Wallet.prototype);
        obj.__wbg_ptr = ptr;
        WalletFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WalletFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wallet_free(ptr, 0);
    }
    /**
     * Primary wallet address (Standard tier, k=3).
     * @returns {string}
     */
    address() {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.wallet_address(this.__wbg_ptr);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * Append a transaction record to `history.cbor` (newest-last on disk;
     * `history()` reverses for display). Called by the JS commit wrappers
     * after each successful protocol op — the WASM machine/commit split
     * doesn't carry the txid/amount/counterparty the native paths record
     * inline, so the browser records it here where that context is known.
     * `tx_type` is one of Send/Receive/Redeem/Heal/Burn/Genesis.
     * @param {string} txid_hex
     * @param {string} tx_type
     * @param {bigint} amount
     * @param {string} counterparty
     * @param {bigint} timestamp
     * @param {string | null | undefined} reference
     * @param {any} fee_breakdown
     */
    appendHistory(txid_hex, tx_type, amount, counterparty, timestamp, reference, fee_breakdown) {
        const ptr0 = passStringToWasm0(txid_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(tx_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(counterparty, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        var ptr3 = isLikeNone(reference) ? 0 : passStringToWasm0(reference, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len3 = WASM_VECTOR_LEN;
        const ret = wasm.wallet_appendHistory(this.__wbg_ptr, ptr0, len0, ptr1, len1, amount, ptr2, len2, timestamp, ptr3, len3, fee_breakdown);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Current balance in atoms.
     * @returns {bigint}
     */
    get balance() {
        const ret = wasm.wallet_balance(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return BigInt.asUintN(64, ret[0]);
    }
    /**
     * Explicit scar-burn — the de-orchestrated counterpart `heal` no longer
     * does implicitly. Burns ONE scarred FACT link per call (a kind=Heal
     * self-send to BURN with `burn_target` set; value is DESTROYED). The
     * webclient surfaces this as a deliberate, user-confirmed action; re-call
     * while scars remain. Two-phase like heal: pass the outcome to
     * [`Wallet::commit_heal`] with `clear_clara=false`. Client-initiated only.
     * @param {any} transport
     * @param {any} params
     * @param {any} progress
     * @returns {Promise<any>}
     */
    burnScarsFund(transport, params, progress) {
        const ret = wasm.wallet_burnScarsFund(this.__wbg_ptr, transport, params, progress);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * KI#34 WI2/WI5 — the sender's designated Nabla `nabla_hint` address for a
     * pending cheque (`null` if none). The webclient's incoming-payment-check
     * selector uses it: "Default" consults this node first; "Secure"/"Random"
     * ignore it so a malicious sender can't steer the check to its own Nabla.
     * @param {string} cheque_id
     * @returns {string | undefined}
     */
    chequeNablaHint(cheque_id) {
        const ptr0 = passStringToWasm0(cheque_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wallet_chequeNablaHint(this.__wbg_ptr, ptr0, len0);
        let v2;
        if (ret[0] !== 0) {
            v2 = getStringFromWasm0(ret[0], ret[1]).slice();
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v2;
    }
    /**
     * Genesis dev-funds claim — **fund phase** (async, network).
     *
     * Runs [`GenesisClaimMachine`]: builds a `kind=GenesisClaim` self-send,
     * runs CL1 locally (embedded AVM), and drives the serial k-witness
     * round over TOT (`transport`). Resolves with a plain JS object:
     *
     * ```js
     * { txidHex, producedStateIdHex, receiptCbor: Uint8Array,
     *   factChainCbor: Uint8Array, witnessCount }
     * ```
     *
     * This call does NOT mutate the wallet (it only reads the keys + polls
     * the inbox). Pass the returned `producedStateIdHex`/`receiptCbor`/
     * `factChainCbor` to [`Wallet::commit_genesis_fund`] to advance wallet
     * state, then register + redeem. The split keeps the network round off
     * the `&mut self` borrow that a browser `Promise` can't hold.
     *
     * `params` is `{ amount, reference, offeredFee, validators: [{validatorId
     * (hex), email}], k, inboxNew, inboxCur, pollIntervalMs, pollMaxRounds }`.
     * `amount` / `offeredFee` are BigInt.
     * @param {any} transport
     * @param {any} params
     * @param {any} progress
     * @returns {Promise<any>}
     */
    claimGenesisFund(transport, params, progress) {
        const ret = wasm.wallet_claimGenesisFund(this.__wbg_ptr, transport, params, progress);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * YPX-020 §2: clear the local hibernation flag after the completion redeem.
     * Core's CL5 zeroes `hibernation_until` on the distress-cheque self-redeem
     * (the witnessed receipt carries hibernation=0), but `commitRedeem` /
     * `commit_protocol_transition` don't touch the local flag — so the webclient
     * mirrors the clear here, exactly like native `heal::hal_complete`. Without
     * it the wallet stays locally "hibernating" and the next send's §15 anchor
     * recomputes a state_hash that won't match the hibernation=0 receipt
     * (E_STATE_NOT_ANCHORED).
     */
    clearHibernation() {
        const ret = wasm.wallet_clearHibernation(this.__wbg_ptr);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Persist and release the lock. The handle becomes unusable afterwards.
     */
    close() {
        const ret = wasm.wallet_close(this.__wbg_ptr);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Genesis dev-funds claim — **commit phase** (sync, local).
     *
     * Advances wallet state with the [`Wallet::claim_genesis_fund`] outcome:
     * `produced_state_id`, balance 0 (credited at redeem), wallet_seq 1, the
     * receipt + FACT chain. Atomic via `commit_protocol_transition`, then
     * persists. After this, register the txid with Nabla and redeem the
     * cheque bundle (the normal receive/redeem path).
     * @param {Uint8Array} produced_state_id
     * @param {Uint8Array} receipt_cbor
     * @param {Uint8Array} fact_chain_cbor
     */
    commitGenesisFund(produced_state_id, receipt_cbor, fact_chain_cbor) {
        const ptr0 = passArray8ToWasm0(produced_state_id, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(receipt_cbor, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(fact_chain_cbor, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.wallet_commitGenesisFund(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Heal **commit phase** (sync, local). Applies a [`Wallet::heal_fund`]
     * outcome and clears CLARA state when `clear_clara` (TX_HEAL), then
     * persists.
     * @param {Uint8Array} produced_state_id
     * @param {bigint} new_balance
     * @param {bigint} new_wallet_seq
     * @param {Uint8Array} receipt_cbor
     * @param {Uint8Array} fact_chain_cbor
     * @param {boolean} clear_clara
     * @param {bigint} hibernation_until
     */
    commitHeal(produced_state_id, new_balance, new_wallet_seq, receipt_cbor, fact_chain_cbor, clear_clara, hibernation_until) {
        const ptr0 = passArray8ToWasm0(produced_state_id, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(receipt_cbor, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(fact_chain_cbor, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.wallet_commitHeal(this.__wbg_ptr, ptr0, len0, new_balance, new_wallet_seq, ptr1, len1, ptr2, len2, clear_clara, hibernation_until);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * YPX-022 **commit phase** for a recall (sync, local): persists the
     * recall bookkeeping row (§2 "Record the recall", REQUIRED) and applies
     * the witnessed outcome — which stamps the recall hibernation window
     * the produced state carries. CLARA is never cleared by a recall.
     * @param {Uint8Array} produced_state_id
     * @param {bigint} new_balance
     * @param {bigint} new_wallet_seq
     * @param {Uint8Array} receipt_cbor
     * @param {Uint8Array} fact_chain_cbor
     * @param {bigint} hibernation_until
     * @param {Uint8Array} recalled_txid
     * @param {Uint8Array} recalled_state_id
     * @param {bigint} recall_amount
     * @param {bigint} recall_tick
     */
    commitRecall(produced_state_id, new_balance, new_wallet_seq, receipt_cbor, fact_chain_cbor, hibernation_until, recalled_txid, recalled_state_id, recall_amount, recall_tick) {
        const ptr0 = passArray8ToWasm0(produced_state_id, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(receipt_cbor, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(fact_chain_cbor, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArray8ToWasm0(recalled_txid, wasm.__wbindgen_malloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passArray8ToWasm0(recalled_state_id, wasm.__wbindgen_malloc);
        const len4 = WASM_VECTOR_LEN;
        const ret = wasm.wallet_commitRecall(this.__wbg_ptr, ptr0, len0, new_balance, new_wallet_seq, ptr1, len1, ptr2, len2, hibernation_until, ptr3, len3, ptr4, len4, recall_amount, recall_tick);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Redeem **commit phase** (sync, local). Credits the balance from a
     * [`Wallet::redeem_fund`] outcome and durably marks the cheque redeemed
     * (double-redeem guard), then persists.
     * @param {Uint8Array} produced_state_id
     * @param {bigint} new_balance
     * @param {bigint} new_wallet_seq
     * @param {Uint8Array} receipt_cbor
     * @param {Uint8Array} fact_chain_cbor
     * @param {string} cheque_id
     */
    commitRedeem(produced_state_id, new_balance, new_wallet_seq, receipt_cbor, fact_chain_cbor, cheque_id) {
        const ptr0 = passArray8ToWasm0(produced_state_id, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(receipt_cbor, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(fact_chain_cbor, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(cheque_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ret = wasm.wallet_commitRedeem(this.__wbg_ptr, ptr0, len0, new_balance, new_wallet_seq, ptr1, len1, ptr2, len2, ptr3, len3);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Send **commit phase** (sync, local). Debits the balance from a
     * [`Wallet::send_fund`] outcome and persists.
     * @param {Uint8Array} produced_state_id
     * @param {bigint} new_balance
     * @param {bigint} new_wallet_seq
     * @param {Uint8Array} receipt_cbor
     * @param {Uint8Array} fact_chain_cbor
     */
    commitSend(produced_state_id, new_balance, new_wallet_seq, receipt_cbor, fact_chain_cbor) {
        const ptr0 = passArray8ToWasm0(produced_state_id, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(receipt_cbor, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(fact_chain_cbor, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.wallet_commitSend(this.__wbg_ptr, ptr0, len0, new_balance, new_wallet_seq, ptr1, len1, ptr2, len2);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Create a new wallet backed by ephemeral in-memory storage.
     * The wallet vanishes when the `MemStorage` reference is dropped.
     * @param {string} name
     * @param {string} email
     * @param {string} wallet_key
     * @param {string} parent_dir
     * @returns {Wallet}
     */
    static createInMemory(name, email, wallet_key, parent_dir) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(email, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(wallet_key, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(parent_dir, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ret = wasm.wallet_createInMemory(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Wallet.__wrap(ret[0]);
    }
    /**
     * Create a new wallet backed by a JS-side storage object.
     * See `JsStorage` docs for the required JS interface.
     * @param {string} name
     * @param {string} email
     * @param {string} wallet_key
     * @param {string} parent_dir
     * @param {any} storage
     * @returns {Wallet}
     */
    static createWithJsStorage(name, email, wallet_key, parent_dir, storage) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(email, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(wallet_key, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(parent_dir, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ret = wasm.wallet_createWithJsStorage(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, storage);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Wallet.__wrap(ret[0]);
    }
    /**
     * Diagnose wallet state and return a prioritised list of recovery
     * actions. Empty array means the wallet is healthy.
     * @returns {any}
     */
    diagnose() {
        const ret = wasm.wallet_diagnose(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Explicitly abandon the interrupted send round (the user chose not to
     * resume). Nothing from it was committed; balance is untouched.
     */
    discardResumableSend() {
        const ret = wasm.wallet_discardResumableSend(this.__wbg_ptr);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * YPX-020 HAL — RE-ANCHOR a healthy wallet whose prior witnesses are
     * unreachable (dead-overlap). A `kind=HalReanchor` self-send Core CL2
     * accepts WITHOUT the S-ABR overlap requirement; the produced state
     * carries a hibernation lock. Two-phase like heal: pass the result to
     * [`Wallet::commit_heal`] (which stamps `hibernationUntil`). Does NOT
     * touch CLARA state. Client-initiated only (CLAUDE.md §14).
     * @param {any} transport
     * @param {any} params
     * @param {any} progress
     * @returns {Promise<any>}
     */
    halReanchorFund(transport, params, progress) {
        const ret = wasm.wallet_halReanchorFund(this.__wbg_ptr, transport, params, progress);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * YPX-022 (repurposed): whether a send's tx is cached (→ the "Recall a
     * payment" affordance can target it). Only a send stashed from THIS
     * wallet file is recallable — the recall must carry the completed
     * send's exact signed tx.
     * @returns {boolean}
     */
    get hasRecallableSend() {
        const ret = wasm.wallet_hasRecallableSend(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Heal / scar-burn — **heal phase** (async, network). Runs
     * [`HealMachine`]: a `kind=Heal` self-send that re-anchors a poisoned
     * state (TX_HEAL, when `garbage_state_ids` is non-empty) or burns the
     * first scarred FACT link. Does NOT mutate the wallet; pass the result
     * to [`Wallet::commit_heal`]. Resolves `{ txidHex, producedStateIdHex,
     * newBalance, newWalletSeq, receiptCbor, factChainCbor, registered,
     * clearClara }`. Errors if there's nothing to heal.
     * @param {any} transport
     * @param {any} params
     * @param {any} progress
     * @returns {Promise<any>}
     */
    healFund(transport, params, progress) {
        const ret = wasm.wallet_healFund(this.__wbg_ptr, transport, params, progress);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * YPX-020: current hibernation deadline (`0` = not hibernating). The
     * webclient gates Send/Redeem and shows the recovery banner on this.
     * @returns {bigint}
     */
    get hibernationUntil() {
        const ret = wasm.wallet_hibernationUntil(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * Transaction history (newest first). `limit` = 0 for all. Pure local
     * read of the wallet's recorded TxRecords. Returns an array of
     * `{ txid, txType, amount, counterparty, timestamp, reference }`.
     * @param {number} limit
     * @returns {any}
     */
    history(limit) {
        const ret = wasm.wallet_history(this.__wbg_ptr, limit);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Wallet info as a plain JS object: `{name, address, addresses, email,
     * balance, sdkVersion}` where `addresses` is `[[tierName, address], ...]`
     * for all 7 YPX-007 security tiers.
     * @returns {any}
     */
    info() {
        const ret = wasm.wallet_info(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * YPX-022: fill `recall_cheque_id` on the recall record after the
     * recall cheque's completion redeem (the webclient calls this alongside
     * `clearHibernation` on the finish-reclaim leg — the wasm redeem path
     * doesn't fill it implicitly the way native `redeem.rs` does). Returns
     * `true` when a matching in-flight recall row was updated.
     * @param {string} recalled_txid_hex
     * @param {string} cheque_id
     * @returns {boolean}
     */
    markRecallCompleted(recalled_txid_hex, cheque_id) {
        const ptr0 = passStringToWasm0(recalled_txid_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(cheque_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.wallet_markRecallCompleted(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Query a Nabla node for a transaction's attestation.
     *
     * Tries each address in turn and resolves with the first successful
     * JSON response (parsed). Resolves with `null` if every address
     * fails or returns non-JSON bytes. The Wallet itself is not read
     * or written — this method is on the handle for JS-API symmetry
     * with desktop.
     *
     * `transport` must implement the [`JsAsyncTransport`] interface.
     * See [`crate::transport`] for the JS-side shape.
     * @param {any} transport
     * @param {Array<any>} addresses
     * @param {string} txid_hex
     * @returns {Promise<any>}
     */
    nablaQueryTxid(transport, addresses, txid_hex) {
        const ptr0 = passStringToWasm0(txid_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wallet_nablaQueryTxid(this.__wbg_ptr, transport, addresses, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Open an existing wallet from a JS-side storage object.
     * @param {string} dir
     * @param {any} storage
     * @returns {Wallet}
     */
    static openWithJsStorage(dir, storage) {
        const ptr0 = passStringToWasm0(dir, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wallet_openWithJsStorage(ptr0, len0, storage);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Wallet.__wrap(ret[0]);
    }
    /**
     * YPX-022 RECALL (repurposed) — **fund phase** (async, network). Opens
     * the recall RESERVATION at Nabla FIRST (consume-once, §2.2.1 — refused
     * with a legible reason unless the send is completion-registered,
     * NotRedeemed, and aged into the recall window; the cheque STAYS
     * redeemable and a racing redeem WINS until the witnessed self-send
     * commits at hibernation-entry), then drives the witnessed
     * `kind=Recall` self-send with the Nabla-stamped attestation (amount
     * pinned to the retracted payment's). No
     * debit — the later redeem of the recall cheque is the only balance
     * write. Two-phase: pass the resolved outcome to
     * [`Wallet::commit_recall`]. Completion = redeem the recall self-cheque
     * after the hibernation window (standard redeem path) +
     * [`Wallet::clear_hibernation`] + [`Wallet::mark_recall_completed_js`],
     * exactly like HAL §2 finish-recovery.
     * @param {any} transport
     * @param {any} params
     * @param {any} progress
     * @returns {Promise<any>}
     */
    recallFund(transport, params, progress) {
        const ret = wasm.wallet_recallFund(this.__wbg_ptr, transport, params, progress);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * YPX-022: the wallet's recall bookkeeping rows, for the UI/audit —
     * `[{recalledTxidHex, amount, recallTick, recallChequeId|null}]`.
     * @returns {any}
     */
    recallRecords() {
        const ret = wasm.wallet_recallRecords(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Scan a maildir inbox for cheques addressed to this wallet.
     * Storage-only — no network. Reads `{maildir_path}/inbox/new/`,
     * moves this wallet's cheques to `inbox/cur/`, persists payloads
     * under `cheques/`, and returns one `PendingCheque` per txid.
     *
     * Single-flight: throws `WalletBusy` if another protocol Machine
     * is currently running on this wallet handle.
     * @param {string} maildir_path
     * @returns {any}
     */
    recv(maildir_path) {
        const ptr0 = passStringToWasm0(maildir_path, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wallet_recv(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Redeem a stored cheque bundle — **redeem phase** (async, network).
     *
     * Runs [`RedeemMachine`]: query-txid → register-cheque-claim → CL5 →
     * typed `RedeemRequestEnvelope` over TOT → k-witness round → finalize.
     * The cheque bundle is loaded + assembled from `cheques/<id>.cbor`.
     * Resolves with a plain JS object:
     *
     * ```js
     * { producedStateIdHex, newBalance, newWalletSeq,
     *   receiptCbor: Uint8Array, factChainCbor: Uint8Array, registered }
     * ```
     *
     * Does NOT mutate the wallet — pass the result to
     * [`Wallet::commit_redeem`] to credit the balance. `params` is
     * `{ validators: [{validatorId (hex), email}], k, nablaTcpAddresses,
     * inboxNew, inboxCur, pollIntervalMs, pollMaxRounds }`.
     * @param {any} transport
     * @param {string} cheque_id
     * @param {any} params
     * @param {any} progress
     * @returns {Promise<any>}
     */
    redeemFund(transport, cheque_id, params, progress) {
        const ptr0 = passStringToWasm0(cheque_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wallet_redeemFund(this.__wbg_ptr, transport, ptr0, len0, params, progress);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * The interrupted-but-resumable send round on this wallet, if one is still
     * valid (the wallet hasn't moved since the timeout). Returns a plain JS
     * object `{ to, amount, sigsHave, sigsNeeded, createdAtSecs }` or `null`.
     * A stale / wrong-format round is cleaned up and reported as `null`. Cheap
     * local read — safe to poll on pane entry / overview render.
     * @returns {any}
     */
    resumableSend() {
        const ret = wasm.wallet_resumableSend(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Resume the interrupted send round — **fund phase** (async, network).
     * Re-enters the SAME [`SendMachine`] with the persisted round: sweep the
     * inbox for responses that arrived after the timeout, then continue the
     * remaining hops with the SAME tx (same txid ⇒ the content-keyed YPX-016
     * witness cache replays a committed validator's response). Resolves with
     * the SAME outcome shape as `sendFund` — pass it to [`Wallet::commit_send`].
     * Errors with `WalletStateStale` if the wallet moved since the interruption
     * (the round is discarded; nothing from it was committed). `params` is the
     * same shape `sendFund` takes (validators, k, nablaTcpAddresses, inbox
     * paths, poll settings); the recipient / amount / reference come from the
     * persisted round.
     * @param {any} transport
     * @param {any} params
     * @param {any} progress
     * @returns {Promise<any>}
     */
    resumeSend(transport, params, progress) {
        const ret = wasm.wallet_resumeSend(this.__wbg_ptr, transport, params, progress);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Persist the wallet to its storage backend. Idempotent.
     */
    save() {
        const ret = wasm.wallet_save(this.__wbg_ptr);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Normal send — **send phase** (async, network). Runs [`SendMachine`]:
     * build a `kind=Normal` TX → CL1 → S-ABR k-witness round over TOT →
     * finalize (sender debited `amount`) → Nabla register. Does NOT mutate
     * the wallet; pass the result to [`Wallet::commit_send`] to debit the
     * balance. Resolves `{ txidHex, producedStateIdHex, newBalance,
     * newWalletSeq, receiptCbor, factChainCbor, registered }`.
     *
     * `to` = receiver wallet_id; `amount` is atoms (BigInt). `params` is
     * `{ validators: [{validatorId (hex), email}], k, nablaTcpAddresses,
     * inboxNew, inboxCur, pollIntervalMs, pollMaxRounds }`.
     * @param {any} transport
     * @param {string} to
     * @param {bigint} amount
     * @param {string} reference
     * @param {any} params
     * @param {any} progress
     * @returns {Promise<any>}
     */
    sendFund(transport, to, amount, reference, params, progress) {
        const ptr0 = passStringToWasm0(to, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(reference, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.wallet_sendFund(this.__wbg_ptr, transport, ptr0, len0, amount, ptr1, len1, params, progress);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Sign an arbitrary message with the wallet's Ed25519 key.
     * Returns 64-byte signature.
     * @param {Uint8Array} message
     * @returns {Uint8Array}
     */
    sign(message) {
        const ptr0 = passArray8ToWasm0(message, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wallet_sign(this.__wbg_ptr, ptr0, len0);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v2;
    }
    /**
     * Stash a send's serde-CBOR transaction (the `sendTxCbor` field
     * `sendFund` surfaces on resolve) so a completed-but-unclaimed payment
     * can later be RECALLED (the recall carries the completed send's own
     * signed tx — Nabla recomputes the txid from it). The browser wallet
     * has no per-txid Send Proof store, so the most recent send is the
     * recallable one; persisted in the wallet file.
     * @param {Uint8Array} tx_cbor
     */
    stashLastSendTx(tx_cbor) {
        const ptr0 = passArray8ToWasm0(tx_cbor, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wallet_stashLastSendTx(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * YPX-021 §8.2: stash the writer's OODS reading a fund outcome surfaced
     * (`oodsAttestationCbor`) — mirror of native nabla.rs caching it from
     * every RegisterAck. The NEXT op carries it; recoveries (heal / HAL /
     * recall) REQUIRE a verified-healthy reading under Core's §8.5 gate.
     * @param {Uint8Array} att_cbor
     */
    stashOodsAttestation(att_cbor) {
        const ptr0 = passArray8ToWasm0(att_cbor, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wallet_stashOodsAttestation(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Full wallet status snapshot — pure local read, no network.
     * See `WalletStatus` in `axiom-sdk-core` for fields.
     * @returns {any}
     */
    status() {
        const ret = wasm.wallet_status(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Verify a typed wallet key against the stored auth_hash. Pure check —
     * does not unlock or mutate. Used to gate reopen / re-prompt before
     * signing. Returns `true` iff the key is correct.
     * @param {string} wallet_key
     * @returns {boolean}
     */
    verifyKey(wallet_key) {
        const ptr0 = passStringToWasm0(wallet_key, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wallet_verifyKey(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Wallet sequence number.
     * @returns {bigint}
     */
    get walletSeq() {
        const ret = wasm.wallet_walletSeq(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return BigInt.asUintN(64, ret[0]);
    }
}
if (Symbol.dispose) Wallet.prototype[Symbol.dispose] = Wallet.prototype.free;

/**
 * Smallest unit constant.
 * @returns {bigint}
 */
export function atomsPerAxc() {
    const ret = wasm.atomsPerAxc();
    return BigInt.asUintN(64, ret);
}

/**
 * Whole AXC → atoms. `axc(1) === 10_000_000_000n`.
 * @param {bigint} whole
 * @returns {bigint}
 */
export function axc(whole) {
    const ret = wasm.axc(whole);
    return BigInt.asUintN(64, ret);
}

/**
 * Fractional AXC → atoms. `axcF(0.5) === 5_000_000_000n`.
 * @param {number} amount
 * @returns {bigint}
 */
export function axcF(amount) {
    const ret = wasm.axcF(amount);
    return BigInt.asUintN(64, ret);
}

/**
 * Build a framed VSP request ready to ship to a validator's VSP
 * endpoint (e.g. via the JS `transport.js` channel). Returns the
 * raw wire bytes (`[u32-BE length | CBOR body]`).
 * @returns {Uint8Array}
 */
export function buildVspRequest() {
    const ret = wasm.buildVspRequest();
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * The CoreID this build was compiled to expect (`CANONICAL_CORE_ID`).
 * Empty string in a dev build with no baked value.
 * @returns {string}
 */
export function canonicalCoreId() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.canonicalCoreId();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Verify an imported proof and, if valid, render its PDF certificate
 * (Uint8Array, with the CBOR bundle embedded). Rejects with the failing reason
 * if the proof is invalid (never renders an invalid certificate).
 * @param {Uint8Array} proof
 * @param {Uint8Array | null} [expected_core_id]
 * @param {Uint8Array | null} [expected_sdid]
 * @returns {Uint8Array}
 */
export function certificatePdfFromProof(proof, expected_core_id, expected_sdid) {
    const ptr0 = passArray8ToWasm0(proof, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(expected_core_id) ? 0 : passArray8ToWasm0(expected_core_id, wasm.__wbindgen_malloc);
    var len1 = WASM_VECTOR_LEN;
    var ptr2 = isLikeNone(expected_sdid) ? 0 : passArray8ToWasm0(expected_sdid, wasm.__wbindgen_malloc);
    var len2 = WASM_VECTOR_LEN;
    const ret = wasm.certificatePdfFromProof(ptr0, len0, ptr1, len1, ptr2, len2);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Worker entry point: run CL1 through the AVM and return the signed DMAP
 * attestation bytes (empty on Core reject). The hosting page runs this in a
 * Web Worker that has called `setup(elf)` in its own context, so the heavy
 * AVM execution never blocks the UI thread. Mirrors the in-process
 * `avm::run_cl1` the async driver falls back to.
 * @param {Uint8Array} tx_json
 * @param {Uint8Array} current_state_json
 * @param {Uint8Array | null | undefined} prev_receipts
 * @param {Uint8Array | null | undefined} fact_chain
 * @param {Uint8Array} client_private_key
 * @param {number} now
 * @returns {Uint8Array}
 */
export function cl1Run(tx_json, current_state_json, prev_receipts, fact_chain, client_private_key, now) {
    const ptr0 = passArray8ToWasm0(tx_json, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(current_state_json, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    var ptr2 = isLikeNone(prev_receipts) ? 0 : passArray8ToWasm0(prev_receipts, wasm.__wbindgen_malloc);
    var len2 = WASM_VECTOR_LEN;
    var ptr3 = isLikeNone(fact_chain) ? 0 : passArray8ToWasm0(fact_chain, wasm.__wbindgen_malloc);
    var len3 = WASM_VECTOR_LEN;
    const ptr4 = passArray8ToWasm0(client_private_key, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ret = wasm.cl1Run(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, now);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v6 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v6;
}

/**
 * Worker entry point for CL5 (see [`cl1_run`]).
 * @param {Uint8Array} receiver_pk
 * @param {Uint8Array} cheque_bundle
 * @param {bigint} current_balance
 * @param {bigint} wallet_seq
 * @param {bigint} current_hibernation
 * @param {Uint8Array} state_id
 * @param {Uint8Array | null | undefined} cheque_claim_proof
 * @param {Uint8Array | null | undefined} txid_attestation
 * @param {Uint8Array} client_private_key
 * @param {number} now
 * @param {Uint8Array | null} [oods_attestation]
 * @returns {Uint8Array}
 */
export function cl5Run(receiver_pk, cheque_bundle, current_balance, wallet_seq, current_hibernation, state_id, cheque_claim_proof, txid_attestation, client_private_key, now, oods_attestation) {
    const ptr0 = passArray8ToWasm0(receiver_pk, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(cheque_bundle, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(state_id, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    var ptr3 = isLikeNone(cheque_claim_proof) ? 0 : passArray8ToWasm0(cheque_claim_proof, wasm.__wbindgen_malloc);
    var len3 = WASM_VECTOR_LEN;
    var ptr4 = isLikeNone(txid_attestation) ? 0 : passArray8ToWasm0(txid_attestation, wasm.__wbindgen_malloc);
    var len4 = WASM_VECTOR_LEN;
    const ptr5 = passArray8ToWasm0(client_private_key, wasm.__wbindgen_malloc);
    const len5 = WASM_VECTOR_LEN;
    var ptr6 = isLikeNone(oods_attestation) ? 0 : passArray8ToWasm0(oods_attestation, wasm.__wbindgen_malloc);
    var len6 = WASM_VECTOR_LEN;
    const ret = wasm.cl5Run(ptr0, len0, ptr1, len1, current_balance, wallet_seq, current_hibernation, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, now, ptr6, len6);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v8 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v8;
}

/**
 * Atoms → human display ("1.5 AXC").
 * @param {bigint} atoms
 * @returns {string}
 */
export function formatAxc(atoms) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.formatAxc(atoms);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Atoms → 2-decimal L$ display for a given digit_version ("100.00 L$").
 * Money-style: whole amounts drop the decimals, a non-zero amount under
 * 0.01 L$ renders "< 0.01 L$", truncated (never rounded up). dv is the
 * Console's *suggested* digit_version (read from worldline.json by the
 * front-end); AXC/atoms are invariant. Mirrors the Mac FFI
 * `format_ldollar_short`.
 * @param {bigint} atoms
 * @param {number} dv
 * @returns {string}
 */
export function formatLdollarShort(atoms, dv) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.formatLdollarShort(atoms, dv);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * CoreID (BLAKE3 of the loaded ELF) as hex. Errors if `setup()` hasn't run.
 * @returns {string}
 */
export function getCoreId() {
    let deferred2_0;
    let deferred2_1;
    try {
        const ret = wasm.getCoreId();
        var ptr1 = ret[0];
        var len1 = ret[1];
        if (ret[3]) {
            ptr1 = 0; len1 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred2_0 = ptr1;
        deferred2_1 = len1;
        return getStringFromWasm0(ptr1, len1);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * 乖乖 (椰子口味) — the axiom-denomination canary. Returning the art proves the
 * AXC/atom converter lib is linked into this wasm; if the dep is ever severed
 * this won't compile. The web wallet shows it as an easter egg (7 taps on the
 * build chip). See the kuaikuai consolidation rule in CLAUDE.md.
 * @returns {string}
 */
export function kuaikuaiArt() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.kuaikuaiArt();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * "1.5 AXC" → atoms. Throws if the input cannot be parsed.
 * @param {string} s
 * @returns {bigint}
 */
export function parseAxc(s) {
    const ptr0 = passStringToWasm0(s, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.parseAxc(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return BigInt.asUintN(64, ret[0]);
}

/**
 * Parse a framed VSP response into JSON. Browser JS then re-parses
 * the JSON; the CBOR→typed→JSON round-trip keeps the FFI surface
 * stable across builds (CBOR field renames don't ripple into the
 * JS bridge).
 * @param {Uint8Array} response_cbor
 * @returns {string}
 */
export function parseVspResponse(response_cbor) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passArray8ToWasm0(response_cbor, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.parseVspResponse(ptr0, len0);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Render the human-readable text certificate for an imported, verified proof.
 * @param {Uint8Array} proof
 * @param {Uint8Array | null} [expected_core_id]
 * @param {Uint8Array | null} [expected_sdid]
 * @returns {string}
 */
export function renderSendCertificateText(proof, expected_core_id, expected_sdid) {
    let deferred5_0;
    let deferred5_1;
    try {
        const ptr0 = passArray8ToWasm0(proof, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(expected_core_id) ? 0 : passArray8ToWasm0(expected_core_id, wasm.__wbindgen_malloc);
        var len1 = WASM_VECTOR_LEN;
        var ptr2 = isLikeNone(expected_sdid) ? 0 : passArray8ToWasm0(expected_sdid, wasm.__wbindgen_malloc);
        var len2 = WASM_VECTOR_LEN;
        const ret = wasm.renderSendCertificateText(ptr0, len0, ptr1, len1, ptr2, len2);
        var ptr4 = ret[0];
        var len4 = ret[1];
        if (ret[3]) {
            ptr4 = 0; len4 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred5_0 = ptr4;
        deferred5_1 = len4;
        return getStringFromWasm0(ptr4, len4);
    } finally {
        wasm.__wbindgen_free(deferred5_0, deferred5_1, 1);
    }
}

/**
 * SDK version string.
 * @returns {string}
 */
export function sdkVersion() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.sdkVersion();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Load the canonical Core ELF and verify its CoreID matches the network
 * canonical. MUST be called once at startup before any send/redeem —
 * the browser analog of `axiom_sdk::setup()`.
 *
 * `elf_bytes` are the bytes of `axiom-core.elf` (the JS side fetches
 * the bundled file and passes them in). Returns the CoreID hex on
 * success. Errors — refusing to run — if the ELF's CoreID does not equal
 * `CANONICAL_CORE_ID` baked into this build, because the WASM client MUST
 * execute the SAME Core as the network validators or every DMAP proof it
 * produces is rejected (docs/AXIOM_DESIGN_WasmClient.md §2).
 * @param {Uint8Array} elf_bytes
 * @returns {string}
 */
export function setup(elf_bytes) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passArray8ToWasm0(elf_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.setup(ptr0, len0);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Atoms → AXC as floating point.
 * @param {bigint} atoms
 * @returns {number}
 */
export function toAxc(atoms) {
    const ret = wasm.toAxc(atoms);
    return ret;
}

/**
 * Verify an imported Send Proof CBOR bundle offline. Returns the decoded verdict
 * object `{ valid, reason, txidHex, senderWalletId, receiverWalletId, amount,
 * reference, messageUtf8, coreIdHex, sdidHex, witnessCount }`. Pass the published
 * anchor's CoreID/SDID (32-byte Uint8Array) to pin, or `undefined` to skip.
 * @param {Uint8Array} proof
 * @param {Uint8Array | null} [expected_core_id]
 * @param {Uint8Array | null} [expected_sdid]
 * @returns {any}
 */
export function verifySendProof(proof, expected_core_id, expected_sdid) {
    const ptr0 = passArray8ToWasm0(proof, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(expected_core_id) ? 0 : passArray8ToWasm0(expected_core_id, wasm.__wbindgen_malloc);
    var len1 = WASM_VECTOR_LEN;
    var ptr2 = isLikeNone(expected_sdid) ? 0 : passArray8ToWasm0(expected_sdid, wasm.__wbindgen_malloc);
    var len2 = WASM_VECTOR_LEN;
    const ret = wasm.verifySendProof(ptr0, len0, ptr1, len1, ptr2, len2);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Extract the security level `k` from a wallet address. Returns `null` for
 * special addresses (BURN, DEED) or invalid input.
 * @param {string} wallet_id
 * @returns {number | undefined}
 */
export function walletIdExtractK(wallet_id) {
    const ptr0 = passStringToWasm0(wallet_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.walletIdExtractK(ptr0, len0);
    return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_3639a60ed15f87e7: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_Number_a3d737fd183f7dca: function(arg0) {
            const ret = Number(arg0);
            return ret;
        },
        __wbg_String_8564e559799eccda: function(arg0, arg1) {
            const ret = String(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_bigint_get_as_i64_3af6d4ca77193a4b: function(arg0, arg1) {
            const v = arg1;
            const ret = typeof(v) === 'bigint' ? v : undefined;
            getDataViewMemory0().setBigInt64(arg0 + 8 * 1, isLikeNone(ret) ? BigInt(0) : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_boolean_get_c3dd5c39f1b5a12b: function(arg0) {
            const v = arg0;
            const ret = typeof(v) === 'boolean' ? v : undefined;
            return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
        },
        __wbg___wbindgen_debug_string_07cb72cfcc952e2b: function(arg0, arg1) {
            const ret = debugString(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_in_2617fa76397620d3: function(arg0, arg1) {
            const ret = arg0 in arg1;
            return ret;
        },
        __wbg___wbindgen_is_bigint_d6a8167cac401b95: function(arg0) {
            const ret = typeof(arg0) === 'bigint';
            return ret;
        },
        __wbg___wbindgen_is_function_2f0fd7ceb86e64c5: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_null_066086be3abe9bb3: function(arg0) {
            const ret = arg0 === null;
            return ret;
        },
        __wbg___wbindgen_is_object_5b22ff2418063a9c: function(arg0) {
            const val = arg0;
            const ret = typeof(val) === 'object' && val !== null;
            return ret;
        },
        __wbg___wbindgen_is_string_eddc07a3efad52e6: function(arg0) {
            const ret = typeof(arg0) === 'string';
            return ret;
        },
        __wbg___wbindgen_is_undefined_244a92c34d3b6ec0: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_jsval_eq_403eaa3610500a25: function(arg0, arg1) {
            const ret = arg0 === arg1;
            return ret;
        },
        __wbg___wbindgen_jsval_loose_eq_1978f1e77b4bce62: function(arg0, arg1) {
            const ret = arg0 == arg1;
            return ret;
        },
        __wbg___wbindgen_number_get_dd6d69a6079f26f1: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'number' ? obj : undefined;
            getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_string_get_965592073e5d848c: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_9c75d47bf9e7731e: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg__wbg_cb_unref_158e43e869788cdc: function(arg0) {
            arg0._wbg_cb_unref();
        },
        __wbg_apply_0f21c8b7ff1b23f8: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.apply(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_call_330a13e9abecff0b: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5) {
            const ret = arg0.call(arg1, arg2, arg3, arg4, arg5);
            return ret;
        }, arguments); },
        __wbg_call_a41d6421b30a32c5: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.call(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_call_a6d9545202d34317: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = arg0.call(arg1, arg2, arg3);
            return ret;
        }, arguments); },
        __wbg_call_add9e5a76382e668: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.call(arg1);
            return ret;
        }, arguments); },
        __wbg_crypto_38df2bab126b63dc: function(arg0) {
            const ret = arg0.crypto;
            return ret;
        },
        __wbg_done_b1afd6201ac045e0: function(arg0) {
            const ret = arg0.done;
            return ret;
        },
        __wbg_getRandomValues_c44a50d8cfdaebeb: function() { return handleError(function (arg0, arg1) {
            arg0.getRandomValues(arg1);
        }, arguments); },
        __wbg_get_41476db20fef99a8: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_get_652f640b3b0b6e3e: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_9cfea9b7bbf12a15: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_get_unchecked_be562b1421656321: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_with_ref_key_6412cf3094599694: function(arg0, arg1) {
            const ret = arg0[arg1];
            return ret;
        },
        __wbg_instanceof_ArrayBuffer_eab9f28fbec23477: function(arg0) {
            let result;
            try {
                result = arg0 instanceof ArrayBuffer;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Promise_1208ac2399c33e10: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Promise;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Uint8Array_57d77acd50e4c44d: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Uint8Array;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_isArray_c6c6ef8308995bcf: function(arg0) {
            const ret = Array.isArray(arg0);
            return ret;
        },
        __wbg_isSafeInteger_3c56c421a5b4cce4: function(arg0) {
            const ret = Number.isSafeInteger(arg0);
            return ret;
        },
        __wbg_iterator_9d68985a1d096fc2: function() {
            const ret = Symbol.iterator;
            return ret;
        },
        __wbg_length_0a6ce016dc1460b0: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_length_8ee39b2a83a5ebf3: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_length_ba3c032602efe310: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_msCrypto_bd5a034af96bcba6: function(arg0) {
            const ret = arg0.msCrypto;
            return ret;
        },
        __wbg_new_2fad8ca02fd00684: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_new_3baa8d9866155c79: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_new_46ae4e4ff2a07a64: function() {
            const ret = new Map();
            return ret;
        },
        __wbg_new_8454eee672b2ba6e: function(arg0) {
            const ret = new Uint8Array(arg0);
            return ret;
        },
        __wbg_new_eb8acd9352be84ba: function(arg0, arg1) {
            try {
                var state0 = {a: arg0, b: arg1};
                var cb0 = (arg0, arg1) => {
                    const a = state0.a;
                    state0.a = 0;
                    try {
                        return wasm_bindgen__convert__closures_____invoke__h035e0d6aed1996be(a, state0.b, arg0, arg1);
                    } finally {
                        state0.a = a;
                    }
                };
                const ret = new Promise(cb0);
                return ret;
            } finally {
                state0.a = 0;
            }
        },
        __wbg_new_from_slice_5a173c243af2e823: function(arg0, arg1) {
            const ret = new Uint8Array(getArrayU8FromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_typed_1137602701dc87d4: function(arg0, arg1) {
            try {
                var state0 = {a: arg0, b: arg1};
                var cb0 = (arg0, arg1) => {
                    const a = state0.a;
                    state0.a = 0;
                    try {
                        return wasm_bindgen__convert__closures_____invoke__h035e0d6aed1996be(a, state0.b, arg0, arg1);
                    } finally {
                        state0.a = a;
                    }
                };
                const ret = new Promise(cb0);
                return ret;
            } finally {
                state0.a = 0;
            }
        },
        __wbg_new_with_length_9011f5da794bf5d9: function(arg0) {
            const ret = new Uint8Array(arg0 >>> 0);
            return ret;
        },
        __wbg_next_261c3c48c6e309a5: function(arg0) {
            const ret = arg0.next;
            return ret;
        },
        __wbg_next_aacee310bcfe6461: function() { return handleError(function (arg0) {
            const ret = arg0.next();
            return ret;
        }, arguments); },
        __wbg_node_84ea875411254db1: function(arg0) {
            const ret = arg0.node;
            return ret;
        },
        __wbg_now_4f457f10f864aec5: function() {
            const ret = Date.now();
            return ret;
        },
        __wbg_of_96154841226db59c: function(arg0, arg1) {
            const ret = Array.of(arg0, arg1);
            return ret;
        },
        __wbg_of_cc555051dc9558d3: function(arg0) {
            const ret = Array.of(arg0);
            return ret;
        },
        __wbg_process_44c7a14e11e9f69e: function(arg0) {
            const ret = arg0.process;
            return ret;
        },
        __wbg_prototypesetcall_fd4050e806e1d519: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
        },
        __wbg_push_60a5366c0bb22a7d: function(arg0, arg1) {
            const ret = arg0.push(arg1);
            return ret;
        },
        __wbg_queueMicrotask_40ac6ffc2848ba77: function(arg0) {
            queueMicrotask(arg0);
        },
        __wbg_queueMicrotask_74d092439f6494c1: function(arg0) {
            const ret = arg0.queueMicrotask;
            return ret;
        },
        __wbg_randomFillSync_6c25eac9869eb53c: function() { return handleError(function (arg0, arg1) {
            arg0.randomFillSync(arg1);
        }, arguments); },
        __wbg_require_b4edbdcf3e2a1ef0: function() { return handleError(function () {
            const ret = module.require;
            return ret;
        }, arguments); },
        __wbg_resolve_9feb5d906ca62419: function(arg0) {
            const ret = Promise.resolve(arg0);
            return ret;
        },
        __wbg_set_5337f8ac82364a3f: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = Reflect.set(arg0, arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_set_6be42768c690e380: function(arg0, arg1, arg2) {
            arg0[arg1] = arg2;
        },
        __wbg_set_82f7a370f604db70: function(arg0, arg1, arg2) {
            const ret = arg0.set(arg1, arg2);
            return ret;
        },
        __wbg_set_b0d9dc239ecdb765: function(arg0, arg1, arg2) {
            arg0.set(getArrayU8FromWasm0(arg1, arg2));
        },
        __wbg_set_f614f6a0608d1d1d: function(arg0, arg1, arg2) {
            arg0[arg1 >>> 0] = arg2;
        },
        __wbg_static_accessor_GLOBAL_THIS_1c7f1bd6c6941fdb: function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_GLOBAL_e039bc914f83e74e: function() {
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_SELF_8bf8c48c28420ad5: function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_WINDOW_6aeee9b51652ee0f: function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_subarray_fbe3cef290e1fa43: function(arg0, arg1, arg2) {
            const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
            return ret;
        },
        __wbg_then_20a157d939b514f5: function(arg0, arg1) {
            const ret = arg0.then(arg1);
            return ret;
        },
        __wbg_then_5ef9b762bc91555c: function(arg0, arg1, arg2) {
            const ret = arg0.then(arg1, arg2);
            return ret;
        },
        __wbg_value_f852716acdeb3e82: function(arg0) {
            const ret = arg0.value;
            return ret;
        },
        __wbg_versions_276b2795b1c6a219: function(arg0) {
            const ret = arg0.versions;
            return ret;
        },
        __wbg_warn_1f9b94806da61fbb: function(arg0) {
            console.warn(arg0);
        },
        __wbindgen_cast_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [Externref], shim_idx: 259, ret: Result(Unit), inner_ret: Some(Result(Unit)) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen__convert__closures_____invoke__he5c5569f8eeafad8);
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000003: function(arg0) {
            // Cast intrinsic for `I64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000004: function(arg0, arg1) {
            // Cast intrinsic for `Ref(Slice(U8)) -> NamedExternref("Uint8Array")`.
            const ret = getArrayU8FromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000005: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000006: function(arg0) {
            // Cast intrinsic for `U64 -> Externref`.
            const ret = BigInt.asUintN(64, arg0);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./axiom_sdk_wasm_bg.js": import0,
    };
}

function wasm_bindgen__convert__closures_____invoke__he5c5569f8eeafad8(arg0, arg1, arg2) {
    const ret = wasm.wasm_bindgen__convert__closures_____invoke__he5c5569f8eeafad8(arg0, arg1, arg2);
    if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
    }
}

function wasm_bindgen__convert__closures_____invoke__h035e0d6aed1996be(arg0, arg1, arg2, arg3) {
    wasm.wasm_bindgen__convert__closures_____invoke__h035e0d6aed1996be(arg0, arg1, arg2, arg3);
}

const WalletFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wallet_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(state => wasm.__wbindgen_destroy_closure(state.a, state.b));

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function makeMutClosure(arg0, arg1, f) {
    const state = { a: arg0, b: arg1, cnt: 1 };
    const real = (...args) => {

        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            state.a = a;
            real._wbg_cb_unref();
        }
    };
    real._wbg_cb_unref = () => {
        if (--state.cnt === 0) {
            wasm.__wbindgen_destroy_closure(state.a, state.b);
            state.a = 0;
            CLOSURE_DTORS.unregister(state);
        }
    };
    CLOSURE_DTORS.register(real, state, state);
    return real;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('axiom_sdk_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };

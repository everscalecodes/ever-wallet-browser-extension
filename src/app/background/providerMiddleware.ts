import {
    ProviderApi,
    Permission,
    FunctionCall,
    FullContractState,
    GenTimings,
    TokensObject,
} from 'ton-inpage-provider'
import { RpcErrorCode } from '@shared/errors'
import { NekotonRpcError, UniqueArray } from '@shared/utils'
import { JsonRpcMiddleware, JsonRpcRequest } from '@shared/jrpc'
import * as nt from '@nekoton'

import { ApprovalController } from './controllers/ApprovalController'
import { PermissionsController, validatePermission } from './controllers/PermissionsController'
import { ConnectionController } from './controllers/ConnectionController'
import { AccountController } from './controllers/AccountController'
import { SubscriptionController } from './controllers/SubscriptionController'
import { LastTransactionId } from '@nekoton'

const invalidRequest = (req: JsonRpcRequest<unknown>, message: string, data?: unknown) =>
    new NekotonRpcError(RpcErrorCode.INVALID_REQUEST, `${req.method}: ${message}`, data)

interface CreateProviderMiddlewareOptions {
    origin: string
    tabId?: number
    isInternal: boolean
    approvalController: ApprovalController
    accountController: AccountController
    permissionsController: PermissionsController
    connectionController: ConnectionController
    subscriptionsController: SubscriptionController
}

type ProviderMethod<T extends keyof ProviderApi> = ProviderApi[T] extends {
    input?: infer I
    output?: infer O
}
    ? (
          ...args: [
              ...Parameters<
                  JsonRpcMiddleware<I extends undefined ? {} : I, O extends undefined ? {} : O>
              >,
              CreateProviderMiddlewareOptions
          ]
      ) => Promise<void>
    : never

// helper methods:
//

function requirePermissions<P extends Permission>(
    { origin, isInternal, permissionsController }: CreateProviderMiddlewareOptions,
    permissions: UniqueArray<P>[]
) {
    if (!isInternal) {
        permissionsController.checkPermissions(origin, permissions)
    }
}

type WithParams<P, T> = P & { params: T }

function requireParams<T>(req: JsonRpcRequest<T>): asserts req is WithParams<typeof req, T> {
    if (req.params == null || typeof req.params !== 'object') {
        throw invalidRequest(req, 'required params object')
    }
}

function requireObject<T, O, P extends keyof O>(req: JsonRpcRequest<T>, object: O, key: P) {
    const property = object[key]
    if (typeof property !== 'object') {
        throw invalidRequest(req, `'${key}' must be an object`)
    }
}

function requireOptionalObject<T, O, P extends keyof O>(req: JsonRpcRequest<T>, object: O, key: P) {
    const property = object[key]
    if (property != null && typeof property !== 'object') {
        throw invalidRequest(req, `'${key}' must be an object if specified`)
    }
}

function requireBoolean<T, O, P extends keyof O>(req: JsonRpcRequest<T>, object: O, key: P) {
    const property = object[key]
    if (typeof property !== 'boolean') {
        throw invalidRequest(req, `'${key}' must be a boolean`)
    }
}

function requireOptionalBoolean<T, O, P extends keyof O>(
    req: JsonRpcRequest<T>,
    object: O,
    key: P
) {
    const property = object[key]
    if (property != null && typeof property !== 'boolean') {
        throw invalidRequest(req, `'${key}' must be a boolean if specified`)
    }
}

function requireString<T, O, P extends keyof O>(req: JsonRpcRequest<T>, object: O, key: P) {
    const property = object[key]
    if (typeof property !== 'string' || property.length === 0) {
        throw invalidRequest(req, `'${key}' must be non-empty string`)
    }
}

function requireOptionalString<T, O, P extends keyof O>(req: JsonRpcRequest<T>, object: O, key: P) {
    const property = object[key]
    if (property != null && (typeof property !== 'string' || property.length === 0)) {
        throw invalidRequest(req, `'${key}' must be a non-empty string if provided`)
    }
}

function requireNumber<T, O, P extends keyof O>(req: JsonRpcRequest<T>, object: O, key: P) {
    const property = object[key]
    if (typeof property !== 'number') {
        throw invalidRequest(req, `'${key}' must be a number`)
    }
}

function requireOptionalNumber<T, O, P extends keyof O>(req: JsonRpcRequest<T>, object: O, key: P) {
    const property = object[key]
    if (property != null && typeof property !== 'number') {
        throw invalidRequest(req, `'${key}' must be a number if provider`)
    }
}

function requireArray<T, O, P extends keyof O>(req: JsonRpcRequest<T>, object: O, key: P) {
    const property = object[key]
    if (!Array.isArray(property)) {
        throw invalidRequest(req, `'${key}' must be an array`)
    }
}

function requireOptional<T, O, P extends keyof O>(
    req: JsonRpcRequest<T>,
    object: O,
    key: P,
    predicate: (req: JsonRpcRequest<T>, object: O, key: P) => void
) {
    const property = object[key]
    if (property != null) {
        predicate(req, object, key)
    }
}

function requireTabid<T>(
    req: JsonRpcRequest<T>,
    tabId: number | undefined
): asserts tabId is number {
    if (tabId == null) {
        throw invalidRequest(req, 'Invalid tab id')
    }
}

function requireLastTransactionId<T, O, P extends keyof O>(
    req: JsonRpcRequest<T>,
    object: O,
    key: P
) {
    requireObject(req, object, key)
    const property = (object[key] as unknown) as LastTransactionId
    requireBoolean(req, property, 'isExact')
    requireString(req, property, 'lt')
    requireOptionalString(req, property, 'hash')
}

function requireGenTimings<T, O, P extends keyof O>(req: JsonRpcRequest<T>, object: O, key: P) {
    requireObject(req, object, key)
    const property = (object[key] as unknown) as GenTimings
    requireString(req, property, 'genLt')
    requireNumber(req, property, 'genUtime')
}

function requireContractState<T, O, P extends keyof O>(req: JsonRpcRequest<T>, object: O, key: P) {
    requireObject(req, object, key)
    const property = (object[key] as unknown) as FullContractState
    requireString(req, property, 'balance')
    requireGenTimings(req, property, 'genTimings')
    requireOptional(req, property, 'lastTransactionId', requireLastTransactionId)
    requireBoolean(req, property, 'isDeployed')
}

function requireFunctionCall<T, O, P extends keyof O>(req: JsonRpcRequest<T>, object: O, key: P) {
    requireObject(req, object, key)
    const property = (object[key] as unknown) as FunctionCall
    requireString(req, property, 'abi')
    requireString(req, property, 'method')
    requireObject(req, property, 'params')
}

function requireMethodOrArray<T, O, P extends keyof O>(req: JsonRpcRequest<T>, object: O, key: P) {
    const property = object[key]
    if (typeof property !== 'string' && !Array.isArray(property)) {
        throw invalidRequest(req, `'${key}' must be a method name or an array of possible names`)
    }
}

// Provider api
//

const requestPermissions: ProviderMethod<'requestPermissions'> = async (
    req,
    res,
    _next,
    end,
    { origin, isInternal, permissionsController }
) => {
    if (isInternal) {
        throw invalidRequest(req, 'cannot request permissions for internal streams')
    }

    requireParams(req)

    const { permissions } = req.params
    requireArray(req, req.params, 'permissions')

    const existingPermissions = permissionsController.getPermissions(origin)

    let hasNewPermissions = false
    for (const permission of permissions) {
        validatePermission(permission)

        if (existingPermissions[permission] == null) {
            hasNewPermissions = true
        }
    }

    if (hasNewPermissions) {
        res.result = await permissionsController.requestPermissions(
            origin,
            permissions as Permission[]
        )
    } else {
        res.result = existingPermissions
    }
    end()
}

const disconnect: ProviderMethod<'disconnect'> = async (_req, res, _next, end, ctx) => {
    requirePermissions(ctx, [])

    const { origin, tabId, permissionsController, subscriptionsController } = ctx

    permissionsController.removeOrigin(origin)
    await subscriptionsController.unsubscribeOriginFromAllContracts(origin, tabId)
    res.result = {}
    end()
}

const subscribe: ProviderMethod<'subscribe'> = async (req, res, _next, end, ctx) => {
    requirePermissions(ctx, ['tonClient'])
    requireParams(req)

    const { address, subscriptions } = req.params
    requireString(req, req.params, 'address')
    requireOptionalObject(req, req.params, 'subscriptions')

    if (!nt.checkAddress(address)) {
        throw invalidRequest(req, 'Invalid address')
    }

    const { tabId, subscriptionsController } = ctx
    requireTabid(req, tabId)

    res.result = await subscriptionsController.subscribeToContract(tabId, address, subscriptions)
    end()
}

const unsubscribe: ProviderMethod<'unsubscribe'> = async (req, res, _next, end, ctx) => {
    requirePermissions(ctx, [])
    requireParams(req)

    const { address } = req.params
    requireString(req, req.params, 'address')

    if (!nt.checkAddress(address)) {
        throw invalidRequest(req, 'Invalid address')
    }

    const { tabId, subscriptionsController } = ctx
    requireTabid(req, tabId)

    await subscriptionsController.unsubscribeFromContract(tabId, address)
    res.result = {}
    end()
}

const unsubscribeAll: ProviderMethod<'unsubscribeAll'> = async (req, res, _next, end, ctx) => {
    requirePermissions(ctx, [])
    const { tabId, subscriptionsController } = ctx
    requireTabid(req, tabId)

    await subscriptionsController.unsubscribeFromAllContracts(tabId)

    res.result = {}
    end()
}

const getProviderState: ProviderMethod<'getProviderState'> = async (
    _req,
    res,
    _next,
    end,
    { origin, tabId, connectionController, permissionsController, subscriptionsController }
) => {
    const { selectedConnection } = connectionController.state
    const permissions = permissionsController.getPermissions(origin)

    res.result = {
        selectedConnection: selectedConnection.name,
        permissions,
        subscriptions: tabId ? subscriptionsController.getTabSubscriptions(tabId) : {},
    }
    end()
}

const getFullContractState: ProviderMethod<'getFullContractState'> = async (
    req,
    res,
    _next,
    end,
    ctx
) => {
    requirePermissions(ctx, ['tonClient'])
    requireParams(req)

    const { address } = req.params
    requireString(req, req.params, 'address')

    const { connectionController } = ctx

    try {
        res.result = {
            state: await connectionController.use(
                async ({ data: { connection } }) => await connection.getFullContractState(address)
            ),
        }
        end()
    } catch (e) {
        throw invalidRequest(req, e.toString())
    }
}

const getTransactions: ProviderMethod<'getTransactions'> = async (req, res, _next, end, ctx) => {
    requirePermissions(ctx, ['tonClient'])
    requireParams(req)

    const { address, beforeLt, limit, inclusive } = req.params
    requireString(req, req.params, 'address')
    requireOptionalString(req, req.params, 'beforeLt')
    requireOptionalNumber(req, req.params, 'limit')
    requireOptionalBoolean(req, req.params, 'inclusive')

    const { connectionController } = ctx

    try {
        const transactions = await connectionController.use(
            async ({ data: { connection } }) =>
                await connection.getTransactions(address, beforeLt, limit || 50, inclusive || false)
        )

        const oldestLt =
            transactions.length > 0 ? transactions[transactions.length - 1].id.lt : undefined

        res.result = {
            transactions,
            oldestLt,
        }
        end()
    } catch (e) {
        throw invalidRequest(req, e.toString())
    }
}

const runLocal: ProviderMethod<'runLocal'> = async (req, res, _next, end, ctx) => {
    requirePermissions(ctx, ['tonClient'])
    requireParams(req)

    const { address, cachedState, functionCall } = req.params
    requireString(req, req.params, 'address')
    requireOptionalString(req, req.params, 'cachedState')
    requireFunctionCall(req, req.params, 'functionCall')

    const { connectionController } = ctx

    let contractState = cachedState

    if (contractState == null) {
        contractState = await connectionController.use(
            async ({ data: { connection } }) => await connection.getFullContractState(address)
        )
    }

    if (contractState == null) {
        throw invalidRequest(req, 'Account not found')
    }
    if (!contractState.isDeployed || contractState.lastTransactionId == null) {
        throw invalidRequest(req, 'Account is not deployed')
    }

    try {
        res.result = nt.runLocal(
            contractState.genTimings,
            contractState.lastTransactionId,
            contractState.boc,
            functionCall.abi,
            functionCall.method,
            functionCall.params
        )
        end()
    } catch (e) {
        throw invalidRequest(req, e.toString())
    }
}

const getExpectedAddress: ProviderMethod<'getExpectedAddress'> = async (
    req,
    res,
    _next,
    end,
    ctx
) => {
    requirePermissions(ctx, ['tonClient'])
    requireParams(req)

    const { tvc, abi, workchain, publicKey, initParams } = req.params
    requireString(req, req.params, 'tvc')
    requireString(req, req.params, 'abi')
    requireOptionalNumber(req, req.params, 'workchain')
    requireOptionalString(req, req.params, 'publicKey')

    try {
        res.result = {
            address: nt.getExpectedAddress(tvc, abi, workchain || 0, publicKey, initParams),
        }
        end()
    } catch (e) {
        throw invalidRequest(req, e.toString())
    }
}

const encodeInternalInput: ProviderMethod<'encodeInternalInput'> = async (
    req,
    res,
    _next,
    end,
    ctx
) => {
    requirePermissions(ctx, ['tonClient'])
    requireParams(req)

    requireFunctionCall(req, req, 'params')
    const { abi, method, params } = req.params

    try {
        res.result = {
            boc: nt.encodeInternalInput(abi, method, params),
        }
        end()
    } catch (e) {
        throw invalidRequest(req, e.toString())
    }
}

const decodeInput: ProviderMethod<'decodeInput'> = async (req, res, _next, end, ctx) => {
    requirePermissions(ctx, ['tonClient'])
    requireParams(req)

    const { body, abi, method, internal } = req.params
    requireString(req, req.params, 'body')
    requireString(req, req.params, 'abi')
    requireMethodOrArray(req, req.params, 'method')
    requireBoolean(req, req.params, 'internal')

    try {
        res.result = nt.decodeInput(body, abi, method, internal) || null
        end()
    } catch (e) {
        throw invalidRequest(req, e.toString())
    }
}

const decodeOutput: ProviderMethod<'decodeOutput'> = async (req, res, _next, end, ctx) => {
    requirePermissions(ctx, ['tonClient'])
    requireParams(req)

    const { body, abi, method } = req.params
    requireString(req, req.params, 'body')
    requireString(req, req.params, 'abi')
    requireMethodOrArray(req, req.params, 'method')

    try {
        res.result = nt.decodeOutput(body, abi, method) || null
        end()
    } catch (e) {
        throw invalidRequest(req, e.toString())
    }
}

const decodeTransaction: ProviderMethod<'decodeTransaction'> = async (
    req,
    res,
    _next,
    end,
    ctx
) => {
    requirePermissions(ctx, ['tonClient'])
    requireParams(req)

    const { transaction, abi, method } = req.params
    requireString(req, req.params, 'abi')
    requireMethodOrArray(req, req.params, 'method')

    try {
        res.result = nt.decodeTransaction(transaction, abi, method) || null
        end()
    } catch (e) {
        throw invalidRequest(req, e.toString())
    }
}

const estimateFees: ProviderMethod<'estimateFees'> = async (req, res, _next, end, ctx) => {
    requirePermissions(ctx, ['accountInteraction'])
    requireParams(req)

    const { sender, recipient, amount, payload } = req.params
    requireString(req, req.params, 'sender')
    requireString(req, req.params, 'recipient')
    requireString(req, req.params, 'amount')
    requireOptional(req, req.params, 'payload', requireFunctionCall)

    const { origin, permissionsController, accountController } = ctx

    const allowedAccount = permissionsController.getPermissions(origin).accountInteraction
    if (allowedAccount?.address != sender) {
        throw invalidRequest(req, 'Specified sender is not allowed')
    }

    const selectedAddress = allowedAccount.address

    let body: string = ''
    if (payload != null) {
        try {
            body = nt.encodeInternalInput(payload.abi, payload.method, payload.params)
        } catch (e) {
            throw invalidRequest(req, e.toString())
        }
    }

    const fees = await accountController.useSubscription(selectedAddress, async (wallet) => {
        const contractState = await wallet.getContractState()
        if (contractState == null) {
            throw invalidRequest(req, `Failed to get contract state for ${selectedAddress}`)
        }

        let unsignedMessage: nt.UnsignedMessage | undefined = undefined
        try {
            unsignedMessage = wallet.prepareTransfer(
                contractState,
                recipient,
                amount,
                false,
                body,
                60
            )
        } finally {
            contractState.free()
        }

        if (unsignedMessage == null) {
            throw invalidRequest(req, 'Contract must be deployed first')
        }

        try {
            const signedMessage = unsignedMessage.signFake()
            return await wallet.estimateFees(signedMessage)
        } catch (e) {
            throw invalidRequest(req, e.toString())
        } finally {
            unsignedMessage.free()
        }
    })

    res.result = {
        fees,
    }
    end()
}

const sendMessage: ProviderMethod<'sendMessage'> = async (req, res, _next, end, ctx) => {
    requirePermissions(ctx, ['accountInteraction'])
    requireParams(req)

    const { sender, recipient, amount, bounce, payload } = req.params
    requireString(req, req.params, 'sender')
    requireString(req, req.params, 'recipient')
    requireString(req, req.params, 'amount')
    requireBoolean(req, req.params, 'bounce')
    requireOptional(req, req.params, 'payload', requireFunctionCall)

    const { origin, permissionsController, accountController, approvalController } = ctx

    const allowedAccount = permissionsController.getPermissions(origin).accountInteraction
    if (allowedAccount?.address != sender) {
        throw invalidRequest(req, 'Specified sender is not allowed')
    }

    const selectedAddress = allowedAccount.address

    let body: string = ''
    if (payload != null) {
        try {
            body = nt.encodeInternalInput(payload.abi, payload.method, payload.params)
        } catch (e) {
            throw invalidRequest(req, e.toString())
        }
    }

    const { unsignedMessage, fees } = await accountController.useSubscription(
        selectedAddress,
        async (wallet) => {
            const contractState = await wallet.getContractState()
            if (contractState == null) {
                throw invalidRequest(req, `Failed to get contract state for ${selectedAddress}`)
            }

            let unsignedMessage: nt.UnsignedMessage | undefined = undefined
            try {
                unsignedMessage = wallet.prepareTransfer(
                    contractState,
                    selectedAddress,
                    amount,
                    false,
                    body,
                    60
                )
            } finally {
                contractState.free()
            }

            if (unsignedMessage == null) {
                throw invalidRequest(req, 'Contract must be deployed first')
            }

            try {
                const signedMessage = unsignedMessage.signFake()
                const fees = await wallet.estimateFees(signedMessage)

                return {
                    unsignedMessage,
                    fees,
                }
            } catch (e) {
                throw invalidRequest(req, e.toString())
            }
        }
    )

    const password = await approvalController.addAndShowApprovalRequest({
        origin,
        type: 'sendMessage',
        requestData: {
            sender: selectedAddress,
            recipient,
            amount,
            bounce,
            payload,
            fees,
        },
    })

    let signedMessage: nt.SignedMessage
    try {
        unsignedMessage.refreshTimeout()
        signedMessage = await accountController.signPreparedMessage(unsignedMessage, password)
    } catch (e) {
        throw invalidRequest(req, e.toString())
    } finally {
        unsignedMessage.free()
    }

    const transaction = await accountController.sendMessage(selectedAddress, signedMessage)
    res.result = {
        transaction,
    }
    end()
}

const sendExternalMessage: ProviderMethod<'sendExternalMessage'> = async (
    req,
    res,
    _next,
    end,
    ctx
) => {
    requirePermissions(ctx, ['accountInteraction'])
    requireParams(req)

    const { publicKey, recipient, stateInit, payload } = req.params
    requireString(req, req.params, 'publicKey')
    requireString(req, req.params, 'recipient')
    requireOptionalString(req, req.params, 'stateInit')
    requireFunctionCall(req, req.params, 'payload')

    const {
        permissionsController,
        approvalController,
        accountController,
        subscriptionsController,
    } = ctx

    const allowedAccount = permissionsController.getPermissions(origin).accountInteraction
    if (allowedAccount?.publicKey != publicKey) {
        throw invalidRequest(req, 'Specified sender is not allowed')
    }

    const selectedPublicKey = allowedAccount.address

    let unsignedMessage: nt.UnsignedMessage
    try {
        unsignedMessage = nt.createExternalMessage(
            recipient,
            payload.abi,
            payload.method,
            stateInit,
            payload.params,
            selectedPublicKey,
            60
        )
    } catch (e) {
        throw invalidRequest(req, e.toString())
    }

    const password = await approvalController.addAndShowApprovalRequest({
        origin,
        type: 'callContractMethod',
        requestData: {
            publicKey: selectedPublicKey,
            recipient,
            payload,
        },
    })

    let signedMessage: nt.SignedMessage
    try {
        unsignedMessage.refreshTimeout()
        signedMessage = await accountController.signPreparedMessage(unsignedMessage, password)
    } catch (e) {
        throw invalidRequest(req, e.toString())
    } finally {
        unsignedMessage.free()
    }

    const transaction = await subscriptionsController.sendMessage(recipient, signedMessage)
    let output: TokensObject | undefined
    try {
        const decoded = nt.decodeTransaction(transaction, payload.abi, payload.method)
        output = decoded?.output
    } catch (_) {}

    res.result = {
        transaction,
        output,
    }
    end()
}

const providerRequests: { [K in keyof ProviderApi]: ProviderMethod<K> } = {
    requestPermissions,
    disconnect,
    subscribe,
    unsubscribe,
    unsubscribeAll,
    getProviderState,
    getFullContractState,
    getTransactions,
    runLocal,
    getExpectedAddress,
    encodeInternalInput,
    decodeInput,
    decodeOutput,
    decodeTransaction,
    estimateFees,
    sendMessage,
    sendExternalMessage,
}

export const createProviderMiddleware = (
    options: CreateProviderMiddlewareOptions
): JsonRpcMiddleware<unknown, unknown> => {
    return (req, res, next, end) => {
        if (!(providerRequests as any)[req.method]) {
            end(
                new NekotonRpcError(
                    RpcErrorCode.METHOD_NOT_FOUND,
                    `provider method '${req.method}' not found`
                )
            )
        } else {
            ;(providerRequests as { [method: string]: ProviderMethod<any> })
                [req.method](req, res, next, end, options)
                .catch(end)
        }
    }
}

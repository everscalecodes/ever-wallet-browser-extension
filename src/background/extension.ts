import init, * as nt from '../../nekoton/pkg'
import { GqlSocket, mergeTransactions, StorageConnector } from './common'
import ItemType = chrome.contextMenus.ItemType

const LITECLIENT_EXTENSION_ID = 'fakpmbkocblneahenciednepadenbdpb'

const CONFIG_URL: string = 'https://freeton.broxus.com/mainnet.config.json'

chrome.tabs.onUpdated.addListener((_tabId, _changeInfo, tab) => {
    const url = new URL(tab.url ?? '')

    chrome.browserAction.setBadgeText({ text: url.host })
})
;(async () => {
    await init('index_bg.wasm')

    // ADNL example
    // {
    //     const config: Config = await fetch(CONFIG_URL).then(data => data.json()).then(Config.parse);
    //     console.log("Config loaded:", config);
    //
    //     const socket = new AdnlSocket(LITECLIENT_EXTENSION_ID);
    //     const connection = await socket.connect(config);
    //
    //     const core = TonInterface.overAdnl(connection);
    //     console.log(await core.getAccountState());
    // }

    // GraphQL example
    {
        const socket = new GqlSocket()
        const connection = await socket.connect({
            endpoint: 'https://main.ton.dev/graphql',
            timeout: 60000, // 60s
        })

        await startListener(connection)
    }
})()

async function startListener(connection: nt.GqlConnection) {
    const POLLING_INTERVAL = 10000 // 10s

    const storage = new nt.Storage(new StorageConnector())

    // Keystore
    const keystore = await nt.KeyStore.load(storage)
    await keystore.clear()
    await keystore.setMasterKey(
        'Main key',
        'naive pudding fabric canal round peanut nature metal fog exhibit security side',
        '1234'
    )

    const keystoreEntries = await keystore.getKeys()
    if (keystoreEntries.length === 0) {
        return
    }
    const publicKey = keystoreEntries[0].publicKey

    const accountStateCache = new nt.TonWalletStateCache(storage)
    const knownTransactions = new Array<nt.Transaction>()

    const wallet = new nt.TonWallet(publicKey, 'WalletV3')
    const address = wallet.address
    console.log(publicKey, address)

    class TonWalletHandler {
        constructor(private address: string) {}

        onMessageSent(pendingTransaction: nt.PendingTransaction, transaction: nt.Transaction) {
            console.log(pendingTransaction, transaction)
        }

        onMessageExpired(pendingTransaction: nt.PendingTransaction) {
            console.log(pendingTransaction)
        }

        onStateChanged(newState: nt.AccountState) {
            accountStateCache.store(address, newState)
            console.log(newState)
        }

        onTransactionsFound(transactions: Array<nt.Transaction>, info: nt.TransactionsBatchInfo) {
            console.log('New transactions batch: ', info)
            mergeTransactions(knownTransactions, transactions, info)

            console.log('All sorted:', checkTransactionsSorted(knownTransactions))
        }
    }

    const handler = new TonWalletHandler(address)

    console.log('Restored state: ', await accountStateCache.load(address))

    const subscription = await connection.subscribeToTonWallet(address, handler)

    if (knownTransactions.length !== 0) {
        const oldestKnownTransaction = knownTransactions[knownTransactions.length - 1]
        if (oldestKnownTransaction.prevTransactionId != null) {
            await subscription.preloadTransactions(oldestKnownTransaction.prevTransactionId)
        }
    }

    let currentBlockId: string | null = null
    let lastPollingMethod = subscription.pollingMethod
    let i = 0
    while (true) {
        i += 1

        switch (lastPollingMethod) {
            case 'manual': {
                await new Promise<void>((resolve) => {
                    setTimeout(() => resolve(), POLLING_INTERVAL)
                })
                console.log('manual refresh')
                await subscription.refresh()
                break
            }
            case 'reliable': {
                if (lastPollingMethod != 'reliable' || currentBlockId == null) {
                    currentBlockId = (await subscription.getLatestBlock()).id
                }

                const nextBlockId: string = await subscription.waitForNextBlock(currentBlockId, 60)
                console.log(nextBlockId, currentBlockId != nextBlockId)

                await subscription.handleBlock(nextBlockId)
                currentBlockId = nextBlockId
                break
            }
        }

        if (i == 1) {
            console.log('Preparing message')
            const contractState = await subscription.getContractState()
            if (contractState == null) {
                console.log('Contract state is empty')
                continue
            }

            const dest = '0:a921453472366b7feeec15323a96b5dcf17197c88dc0d4578dfa52900b8a33cb'
            const amount = '100000000' // 0.1 TON
            const bounce = false
            const timeout = 60 // expire in 60 seconds

            const unsignedMessage = wallet.prepareTransfer(
                contractState,
                dest,
                amount,
                bounce,
                timeout
            )
            if (unsignedMessage == null) {
                console.log('Contract must be deployed first')
                continue
            }

            // {
            //     const signedMessage = unsignedMessage.signFake()
            //     const totalFees = await subscription.estimateFees(signedMessage)
            //     console.log('Fees:', totalFees)
            // }
            {
                const signedMessage = await keystore.sign(unsignedMessage, '1234')
                const totalFees = await subscription.estimateFees(signedMessage)
                console.log('Signed message fees:', totalFees)

                currentBlockId = (await subscription.getLatestBlock()).id
                const pendingTransaction = await subscription.sendMessage(signedMessage)
                console.log(pendingTransaction)
            }
        }

        lastPollingMethod = subscription.pollingMethod
    }
}

function checkTransactionsSorted(transactions: Array<nt.Transaction>) {
    return transactions.reduce(
        ({ sorted, previous }, current) => {
            const result = previous
                ? sorted && previous.id.lt.localeCompare(current.id.lt) > 0
                : true
            return { sorted: result, previous: current }
        },
        <{ sorted: boolean; previous: nt.Transaction | null }>{ sorted: true, previous: null }
    ).sorted
}

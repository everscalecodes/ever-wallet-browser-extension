import * as React from 'react'

import * as nt from '@nekoton'
import {
    MultisigData,
    MultisigForm,
    PreparedMessage,
} from '@popup/components/DeployWallet/components'
import { useRpc } from '@popup/providers/RpcProvider'
import { closeCurrentWindow, useRpcState } from '@popup/providers/RpcStateProvider'
import { parseError, prepareKey } from '@popup/utils'
import { DeployMessageToPrepare, WalletMessageToSend } from '@shared/backgroundApi'

enum Step {
    ENTER_DATA,
    DEPLOY_MESSAGE,
}

export function DeployMultisigWallet(): JSX.Element {
    const rpc = useRpc()
    const rpcState = useRpcState()

    const [multisigData, setMultisigData] = React.useState<MultisigData>()
    const [inProcess, setInProcess] = React.useState(false)
    const [error, setError] = React.useState<string>()
    const [fees, setFees] = React.useState<string>()
    const [step, setStep] = React.useState(Step.ENTER_DATA)

    const selectedAccount = React.useMemo(() => rpcState.state.selectedAccount?.tonWallet, [])
    if (selectedAccount == null) {
        return <></>
    }

    const selectedDerivedKeyEntry = React.useMemo(() => {
        return selectedAccount.publicKey !== undefined
            ? rpcState.state.storedKeys[selectedAccount.publicKey]
            : undefined
    }, [rpcState, selectedAccount])

    const tonWalletState = React.useMemo(() => {
        return rpcState.state.accountContractStates[selectedAccount.address] as
            | nt.ContractState
            | undefined
    }, [rpcState, selectedAccount])

    const sendMessage = (message: WalletMessageToSend) => {
        rpc.sendMessage(selectedAccount.address, message)
        closeCurrentWindow()
    }

    const onSubmit = async (password: string) => {
        if (selectedDerivedKeyEntry == null) {
            return
        }

        const keyPassword = prepareKey(selectedDerivedKeyEntry, password)
        const params: DeployMessageToPrepare = {
            type: 'multiple_owners',
            custodians: multisigData?.custodians || [],
            reqConfirms: parseInt((multisigData?.reqConfirms as unknown) as string) || 0,
        }

        setError(undefined)
        setInProcess(true)

        await rpc
            .prepareDeploymentMessage(selectedAccount.address, params, keyPassword)
            .then((signedMessage) => {
                sendMessage({ signedMessage, info: { type: 'deploy', data: undefined } })
            })
            .catch((e) => {
                setError(parseError(e))
            })
            .finally(() => {
                setInProcess(false)
            })
    }

    const onNext = (data: MultisigData) => {
        setMultisigData(data)
        setStep(Step.DEPLOY_MESSAGE)
    }

    const onBack = () => {
        setStep(Step.ENTER_DATA)
    }

    React.useEffect(() => {
        if (tonWalletState == null || tonWalletState?.isDeployed) {
            return
        }

        rpc.estimateDeploymentFees(selectedAccount.address)
            .then((fees) => {
                setFees(fees)
            })
            .catch(console.error)
    }, [tonWalletState, selectedAccount])

    return (
        <div className="deploy-wallet">
            <header className="deploy-wallet__header">
                <h2 className="deploy-wallet__header-title">Deploy your wallet</h2>
                {step === Step.DEPLOY_MESSAGE && (
                    <h3 className="deploy-wallet__header-subtitle">
                        Funds will be debited from your balance to deploy.
                    </h3>
                )}
            </header>
            {(() => {
                switch (step) {
                    case Step.DEPLOY_MESSAGE:
                        return (
                            <PreparedMessage
                                balance={tonWalletState?.balance}
                                fees={fees}
                                custodians={multisigData?.custodians}
                                disabled={inProcess}
                                error={error}
                                onSubmit={onSubmit}
                                onBack={onBack}
                            />
                        )

                    default:
                        return <MultisigForm key="multisig" data={multisigData} onSubmit={onNext} />
                }
            })()}
        </div>
    )
}

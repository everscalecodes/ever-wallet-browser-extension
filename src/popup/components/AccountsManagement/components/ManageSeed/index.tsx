import * as React from 'react'
import classNames from 'classnames'

import * as nt from '@nekoton'
import { ExportSeed } from '@popup/components/AccountsManagement/components'
import Button from '@popup/components/Button'
import Input from '@popup/components/Input'
import { Step, useAccountability } from '@popup/providers/AccountabilityProvider'
import { useRpc } from '@popup/providers/RpcProvider'
import { useRpcState } from '@popup/providers/RpcStateProvider'
import { ENVIRONMENT_TYPE_POPUP } from '@shared/constants'

import Arrow from '@popup/img/arrow.svg'
import TonKey from '@popup/img/ton-key.svg'

enum ManageSeedStep {
    INDEX,
    EXPORT_SEED,
}

export function ManageSeed(): JSX.Element {
    const accountability = useAccountability()
    const rpc = useRpc()
    const rpcState = useRpcState()

    const [name, setName] = React.useState(
        accountability.currentMasterKey !== undefined
            ? accountability.masterKeysNames[accountability.currentMasterKey.masterKey] || ''
            : ''
    )
    const [step, setStep] = React.useState<ManageSeedStep>(ManageSeedStep.INDEX)

    const currentDerivedKeyPubKey = React.useMemo(() => {
        if (accountability.selectedAccount?.tonWallet.publicKey !== undefined) {
            return rpcState.state.storedKeys[accountability.selectedAccount.tonWallet.publicKey]
                ?.publicKey
        }
        return undefined
    }, [accountability.selectedAccount, rpcState.state.storedKeys])

    const addKey = () => {
        accountability.setStep(Step.CREATE_DERIVED_KEY)
    }

    const saveName = async () => {
        if (accountability.currentMasterKey !== undefined && name) {
            await rpc.updateMasterKeyName(accountability.currentMasterKey.masterKey, name)
        }
    }

    const onManageDerivedKey = (key: nt.KeyStoreEntry) => {
        return () => accountability.onManageDerivedKey(key)
    }

    const onExportSeed = async () => {
        setStep(ManageSeedStep.EXPORT_SEED)
    }

    const onBack = () => {
        switch (step) {
            case ManageSeedStep.EXPORT_SEED:
                setStep(ManageSeedStep.INDEX)
                break

            default:
                accountability.reset()
                accountability.setStep(Step.MANAGE_SEEDS)
        }
    }

    return (
        <>
            {step == ManageSeedStep.INDEX && (
                <div key="index" className="accounts-management">
                    <header className="accounts-management__header">
                        <h2 className="accounts-management__header-title">Manage seed phrase</h2>
                    </header>

                    <div className="accounts-management__wrapper">
                        <div className="accounts-management__content">
                            <div className="accounts-management__content-header">Seed name</div>
                            <div className="accounts-management__name-field">
                                <Input
                                    name="seed_name"
                                    label="Enter seed name"
                                    type="text"
                                    autocomplete="off"
                                    value={name || ''}
                                    onChange={(e) => setName(e.target.value)}
                                />
                                {accountability.currentMasterKey !== undefined &&
                                    (accountability.masterKeysNames[
                                        accountability.currentMasterKey.masterKey
                                    ] !== undefined ||
                                        name) &&
                                    accountability.masterKeysNames[
                                        accountability.currentMasterKey.masterKey
                                    ] !== name && (
                                        <a
                                            role="button"
                                            className="accounts-management__name-button"
                                            onMouseDown={saveName}
                                        >
                                            Save
                                        </a>
                                    )}
                            </div>

                            <div
                                className="accounts-management__content-header"
                                style={{ marginTop: 16 }}
                            >
                                Keys
                                {accountability.currentMasterKey?.signerName !== 'encrypted_key' ? (
                                    <a role="button" className="extra" onClick={addKey}>
                                        + Add new
                                    </a>
                                ) : (
                                    <small>(only one is available for legacy seed)</small>
                                )}
                            </div>

                            <div className="accounts-management__divider" />

                            <ul className="accounts-management__list">
                                {accountability.derivedKeys
                                    .sort((a, b) => a.accountId - b.accountId)
                                    .map((key) => {
                                        const isActive = currentDerivedKeyPubKey === key.publicKey
                                        return (
                                            <li key={key.publicKey}>
                                                <div
                                                    role="button"
                                                    className={classNames(
                                                        'accounts-management__list-item',
                                                        {
                                                            'accounts-management__list-item--active':
                                                                isActive,
                                                        }
                                                    )}
                                                    onClick={onManageDerivedKey(key)}
                                                >
                                                    <img
                                                        src={TonKey}
                                                        alt=""
                                                        className="accounts-management__list-item-logo"
                                                    />
                                                    <div className="accounts-management__list-item-title">
                                                        {key.name}
                                                    </div>
                                                    <img
                                                        src={Arrow}
                                                        alt=""
                                                        style={{ height: 24, width: 24 }}
                                                    />
                                                </div>
                                            </li>
                                        )
                                    })}
                            </ul>
                        </div>

                        <footer className="accounts-management__footer">
                            {rpcState.activeTab?.type != ENVIRONMENT_TYPE_POPUP && (
                                <div className="accounts-management__footer-button-back">
                                    <Button text="Back" white onClick={onBack} />
                                </div>
                            )}
                            <Button text="Export seed" onClick={onExportSeed} />
                        </footer>
                    </div>
                </div>
            )}

            {step === ManageSeedStep.EXPORT_SEED && <ExportSeed key="exportSeed" onBack={onBack} />}
        </>
    )
}

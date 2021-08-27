import * as React from 'react'

import { Step, useAccountability } from '@popup/providers/AccountabilityProvider'
import Button from '@popup/components/Button'
import Nav from '@popup/components/Nav'
import AccountSelector from '@popup/components/AccountSelector'

const PAGE_LENGTH = 5;

type PublicKeys = Map<string, number>

interface ISelectDerivedKeys {
    onSubmit: (publicKeys: PublicKeys) => void,
    publicKeys: PublicKeys
    masterKey: string
    error?: string
    inProcess?: boolean
}

export function SelectDerivedKeys({
    onSubmit,
    publicKeys,
    masterKey,
    error,
    inProcess,
}: ISelectDerivedKeys): JSX.Element {
    const accountability = useAccountability()
    const { derivedKeys } = accountability
    const [selectedKeys, setSelectedKeys] = React.useState<Map<string, number>>(new Map())
    const [currentPage, setCurrentPage] = React.useState<number>(0)

    const pagesCount = Math.ceil(publicKeys.size / PAGE_LENGTH)
    const startIndex = currentPage * PAGE_LENGTH
    const endIndex = startIndex + PAGE_LENGTH
    const visiblePublicKeys = [...publicKeys.keys()].slice(startIndex, endIndex)

    const onBack = () => {
        accountability.setStep(Step.MANAGE_SEED)
    }

    const onSelect = () => {
        onSubmit(selectedKeys)
    }

    const onCheck = (checked: boolean, publicKey: string) => {
        setSelectedKeys((selectedKeys) => {
            const accountId = publicKeys.get(publicKey)

            if (checked && accountId !== undefined) {
                selectedKeys.set(publicKey, accountId)
            } else if (!checked) {
                selectedKeys.delete(publicKey)
            }

            return new Map([...selectedKeys])
        })
    }

    const onClickNext = () => {
        setCurrentPage((currentPage) => {
            return currentPage < pagesCount - 1 ? ++currentPage : currentPage
        })
    }

    const onClickPrev = () => {
        setCurrentPage((currentPage) => {
            return currentPage > 0 ? --currentPage : currentPage
        })
    }

    React.useEffect(() => {
        setSelectedKeys((selectedKeys) => {
            return new Map([...selectedKeys].concat(derivedKeys.map(derivedKey => (
                [derivedKey.publicKey, derivedKey.accountId]
            ))))
        })
    }, [derivedKeys])

    return (
        <div className="accounts-management">
            <header className="accounts-management__header">
                <h2 className="accounts-management__header-title">Select keys you need</h2>
            </header>

            <div className="accounts-management__wrapper">
                <div>
                    <Nav
                        showNext
                        showPrev
                        onClickNext={onClickNext}
                        onClickPrev={onClickPrev}
                        hint={`${currentPage + 1} of ${pagesCount}`}
                        title="Keys"
                    />

                    {visiblePublicKeys.map((publicKey, index) => (
                        <AccountSelector
                            key={publicKey}
                            publicKey={publicKey}
                            checked={selectedKeys.has(publicKey)}
                            setChecked={(checked) => onCheck(checked, publicKey)}
                            index={`${startIndex + index + 1}`}
                            preselected={publicKey === masterKey}
                        />
                    ))}
                    {error && (
                        <div className="accounts-management__content-error">{error}</div>
                    )}
                </div>

                <footer className="accounts-management__footer">
                    <div className="accounts-management__footer-button-back">
                        <Button text="Back" disabled={inProcess} white onClick={onBack} />
                    </div>

                    <Button text="Select" disabled={inProcess} onClick={onSelect} />
                </footer>
            </div>
        </div>
    )
}

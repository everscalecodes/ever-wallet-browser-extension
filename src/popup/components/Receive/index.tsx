import React from 'react'

import QRCode from 'react-qr-code'
import CopyButton from '@components/CopyButton'
import Button from '@components/Button'

import UserPic from '@img/user-avatar-placeholder.svg'

import './style.scss'

interface IReceive {
    accountName?: string
    address: string
}

const Receive: React.FC<IReceive> = ({ accountName, address }) => (
    <>
        <div className="receive-screen__account_details">
            <UserPic />
            <span className="receive-screen__account_details-title">{accountName || ''}</span>
        </div>

        <h3 className="receive-screen__form-title">Your address to receive TON funds</h3>
        <div className="receive-screen__qr-code">
            <div className="receive-screen__qr-code-code">
                <QRCode value={`ton://chat/${address}`} size={80} />
            </div>
            <div className="receive-screen__qr-code-address">{address}</div>
        </div>

        <CopyButton text={address}>
            <Button text={'Copy address'} />
        </CopyButton>
    </>
)

export default Receive
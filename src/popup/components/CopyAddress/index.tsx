import React from 'react'
import CopyToClipboard from 'react-copy-to-clipboard'
import ReactTooltip from 'react-tooltip'
import { convertAddress } from '@shared/utils'
import './style.scss'

interface IWalletAddress {
    address: string
}
const WalletAddress: React.FC<IWalletAddress> = ({ address }) => (
    <>
        <CopyToClipboard
            text={address}
            onCopy={() => {
                ReactTooltip.hide()
            }}
        >
            <span className="clickable-address" data-tip="Click to copy">
                {convertAddress(address)}
            </span>
        </CopyToClipboard>
        <ReactTooltip type="dark" effect="solid" place="bottom" />
    </>
)

export default WalletAddress

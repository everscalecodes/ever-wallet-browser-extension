import React, { useEffect, useRef } from 'react'
import './modal.scss'

const Modal: React.FC<any> = ({ setModalVisible, children }) => {
    const hideModalOnClick = (ref: React.MutableRefObject<null>) => {
        const handleClickOutside = (event: { target: any }) => {
            // @ts-ignore
            if (ref.current && !ref.current.contains(event.target)) {
                setModalVisible(false)
            }
        }
        useEffect(() => {
            document.addEventListener('mousedown', handleClickOutside)
            return () => {
                document.removeEventListener('mousedown', handleClickOutside)
            }
        })
    }

    const Wrapper = (props: any) => {
        const wrapperRef = useRef(null)
        hideModalOnClick(wrapperRef)
        return (
            <div ref={wrapperRef} className="modal">
                {props.children}
            </div>
        )
    }

    return <Wrapper>{children}</Wrapper>
}

export default Modal

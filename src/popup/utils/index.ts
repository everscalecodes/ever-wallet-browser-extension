import Decimal from 'decimal.js'
import { memoize } from 'lodash'
import { AppDispatch } from '../store'
import {
    ENVIRONMENT_TYPE_NOTIFICATION,
    ENVIRONMENT_TYPE_POPUP,
    ENVIRONMENT_TYPE_BACKGROUND,
} from '../../shared/constants'

Decimal.set({ maxE: 500, minE: -500 })

window.ObjectExt = {
    keys: Object.keys,
    entries: Object.entries,
}

export type Action<F extends Function> = F extends (
    ...args: infer A
) => (app: AppDispatch) => Promise<infer R>
    ? (...args: A) => Promise<R>
    : never

export const ONE_TON = '1000000000'

export const formatSeed = (seed: string) => seed?.split(/[, ;\r\n\t]+/g).filter((el) => el !== '')

export const convertAddress = (address: string | undefined) =>
    address ? `${address?.slice(0, 6)}...${address?.slice(-4)}` : ''

export const convertTons = (amount?: string) => new Decimal(amount || '0').div(ONE_TON).toString()

export const estimateUsd = (amount: string) => {
    return `${new Decimal(amount || '0').div(ONE_TON).mul('0.6').toFixed(2).toString()}`
}

export const parseTons = (amount: string) => {
    return new Decimal(amount).mul(ONE_TON).ceil().toFixed(0)
}

export const shuffleArray = <T>(array: T[]) => {
    let currentIndex = array.length
    let temporaryValue: T
    let randomIndex: number

    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex)
        currentIndex -= 1

        temporaryValue = array[currentIndex]
        array[currentIndex] = array[randomIndex]
        array[randomIndex] = temporaryValue
    }

    return array
}

const getEnvironmentTypeCached = memoize((url) => {
    const parseUrl = new URL(url)
    if (parseUrl.pathname === '/popup.html') {
        return ENVIRONMENT_TYPE_POPUP
    } else if (parseUrl.pathname === '/notification.html') {
        return ENVIRONMENT_TYPE_NOTIFICATION
    }
    return ENVIRONMENT_TYPE_BACKGROUND
})

export const getEnvironmentType = (url = window.location.href) => getEnvironmentTypeCached(url)
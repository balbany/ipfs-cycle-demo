import {run} from '@cycle/run'
import {makeDOMDriver} from '@cycle/dom'
import {makeClearInputDriver} from './drivers/clearInput.driver'
import {makeIPFSRoomDriver} from './drivers/ipfs-pubsub-room.driver'
import {App} from './app'

const main = App

const drivers = {
  DOM: makeDOMDriver('#app'),
  ClearInput: makeClearInputDriver(),
  Room: makeIPFSRoomDriver('TestRoom123')
}

run(main, drivers)



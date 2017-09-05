import {makeDOMDriver, div, input, label, ul, li, img, p, small, h4, a, span} from '@cycle/dom'
import xs from 'xstream'
import debounce from 'xstream/extra/debounce'

function intent({DOM, Room}) {
  const message$ = DOM.select('.message-input').events('change')

  const elem$ = message$
    .map(ev => ev.target)

  const addMessage$ = message$
    .map(ev => ev.target.value)
    .filter(val => val.trim())

  const newMessage$ = Room;

  const changeUsername$ = DOM.select('.username').events('input')
    .compose(debounce(500))
    .map(ev => ev.target.value)
    .filter(val => val.length > 0)

  return {elem$, addMessage$, newMessage$, changeUsername$}
}

function model(actions) {
  const messages$ = actions.newMessage$
    .map(message => state => 
      Object.assign({}, state, {messages: state.messages.concat(message.data.toString())})
    )

  const username$ = actions.changeUsername$
    .map(username => state =>
      Object.assign({}, state, {username})
    )

  const state$ = xs.merge(messages$, username$)
    .fold((state, action) => action(state), {messages: [], username: ''})
    .startWith({messages: [], username: ''})

  return state$
}

function formatAMPM(date) {
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  minutes = minutes < 10 ? '0'+minutes : minutes;
  var strTime = hours + ':' + minutes + ' ' + ampm;
  return strTime;
}

function chatBubble(me, message) {
    let date = formatAMPM(new Date());
    return me ? li('', {attrs: {style: 'width:100%'}}, [
      div('.msj.macro', [
        div('.avatar', [
          img('.img-circle', {attrs: {style: 'width:100%', src: '/images/me.jpg'}})
        ]),
        div('.text.text-l', [
          p(message),
          p(small(date))
        ])
      ])]) : li('', {attrs: {style: 'width:100%'}}, [div('.msj-rta.macro', [
          div('.text.text-r', [
            p(message),
            p(small(date))
          ]),
          div('.avatar', {attrs: {style: 'padding:0px 0px 0px 10px !important'}}, [
            img('.img-circle', {attrs: {style: 'width:100%', src: '/images/them.jpg'}})
          ])
        ])
      ])
}

function view(state$) {
  return state$.map(state =>
    div([
      div('.bg-primary.col-sm-3.col-sm-offset-4', [
        span('.pull-right', {attrs: { style: 'padding-top: 8px' }} ,[a('.github-button.pull-right', {attrs: {href: 'https://github.com/balbany/ipfs-cycle-demo'}}, 'View Code')]),
        h4('IPFS-CycleJS Chat Demo')
      ]),
      div('.col-sm-3.col-sm-offset-4.frame',[
        ul(state.messages.map(message =>
            chatBubble(message.substring(0, message.lastIndexOf(':')) === state.username, message)
        )),
        div('.msj-rta.macro', {attrs: {style: 'margin:auto'}}, [
          div('.text.text-l', {attrs: {style: 'background:whitesmoke !important'}}, [
            input('.username.mytext', {attrs: {type: 'text', placeholder: 'Type a username'}})
          ]),
          div('.text.text-r', {attrs: {style: 'background:whitesmoke !important'}}, [
            input('.message-input.mytext', {attrs: {type: 'text', placeholder: 'Type a message'}})
          ])
        ])
      ])
    ])
  )
}



export function App (sources) {

  const actions = intent(sources)
  const vtree$ = view(model(actions))

  const outgoing$ = xs.combine(actions.addMessage$, actions.changeUsername$)
    .map(([message, username]) =>
      (`${username}: ${message}`)
    )

  const sinks = {
    DOM: vtree$,
    Room: outgoing$,
    ClearInput: actions.elem$
  }

  return sinks
}

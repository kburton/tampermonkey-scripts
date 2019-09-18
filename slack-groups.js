// ==UserScript==
// @name         Slack Groups
// @namespace    https://www.kappasoft.net/
// @version      0.1
// @description  Highlight channel groups (tap shift three times to activate)
// @author       Keith Burton
// @match        https://app.slack.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict'

  const modal = (() => {
    const dialogNode = document.createElement('div')
    dialogNode.className = 'modal__dialog'

    const wrapperNode = document.createElement('div')
    wrapperNode.className = 'modal__wrapper'
    wrapperNode.appendChild(dialogNode)

    const node = document.createElement('div')
    node.className = 'modal'
    node.appendChild(wrapperNode)

    const show = (contentNode) => {
      dialogNode.innerHTML = ''
      dialogNode.appendChild(contentNode)
      node.className = 'modal modal--visible'
    }

    const hide = () => {node.className = 'modal'}

    return {
      node,
      show,
      hide
    }
  })()

  const style = (() => {
    const node = document.createElement('style')
    node.textContent = `
      .modal {
        display: none;
      }
      .modal--visible {
        display: block;
      }
      .modal__wrapper {
        display: block;
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        background-color: rgba(1, 1, 1, 0.3);
        z-index: 1000000;
      }
      .modal__dialog {
        position: fixed;
        top: 30%;
        left: 25%;
        width: 50%;
        padding: 1em;
        color: #333;
        background-color: white;
        border: 1px solid #444;
        border-radius: 0.5em;
        box-shadow: #555 0 0 10px;
        z-index: 1000001;
      }
    `

    return {
      node
    }
  })()

  const root = (() => {
    const node = document.createElement('div').attachShadow({ mode: 'closed' })
    node.appendChild(style.node)
    node.appendChild(modal.node)

    return {
      node
    }
  })()

  document.body.appendChild(root.node)
  window.slackGroups = {
    modal
  }
})()

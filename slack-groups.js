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

  const slack = (() => {
    const getTeamId = () => document.querySelector('[data-teamid]').dataset.teamid

    const getChannels = () => {
      const channelNodes = [...document.querySelectorAll(
        '[data-qa-channel-sidebar-channel-type=channel], [data-qa-channel-sidebar-channel-type=private]'
      )]
      return channelNodes.map(node => ({
        id: node.dataset.qaChannelSidebarChannelId,
        name: node.innerText
      }))
    }

    return {
      getTeamId,
      getChannels
    }
  })()

  const groups = (() => {
    const all = {}

    const add = (name, color) => {
      if (!all[name]) {
        all[name] = { name, color, channels: {} }
      }
    }
    const remove = (name) => {
      if (all[name]) {
        delete all[name]
      }
    }
    const addChannel = (id, name, groupName) => {
      if (groups[groupName]) {
        groups[groupName].channels[id] = { id, name }
      }
    }
    const removeChannel = (id, groupName) => {
      if (groups[groupName].channels[id]) {
        delete groups[groupName].channels[id]
      }
    }

    return {
      all,
      add,
      remove,
      addChannel,
      removeChannel
    }
  })()

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

  const groupConfigurationForm = (() => {
    const headerNode = document.createElement('h1')

    const nameInputNode = document.createElement('input')
    nameInputNode.className = 'group-configuration-form__name'
    nameInputNode.type = 'text'
    nameInputNode.placeholder = 'Group name'

    const colorInputNode = document.createElement('input')
    colorInputNode.className = 'group-configuration-form__color'
    colorInputNode.type = 'color'

    const groupRowNode = document.createElement('div')
    groupRowNode.className = 'group-configuration-form__row'
    groupRowNode.appendChild(nameInputNode)
    groupRowNode.appendChild(colorInputNode)

    const channelSelectNode = document.createElement('select')
    channelSelectNode.className = 'group-configuration-form__channels'
    channelSelectNode.multiple = true

    const channelSelectRowNode = document.createElement('div')
    channelSelectRowNode.className = 'group-configuration-form__row'
    channelSelectRowNode.appendChild(channelSelectNode)

    const node = document.createElement('div')
    node.className = 'group-configuration-form'
    node.appendChild(headerNode)
    node.appendChild(groupRowNode)
    node.appendChild(channelSelectRowNode)

    const content = (name, color) => {
      if (name === undefined) {
        headerNode.textContent = 'Create Group'
        nameInputNode.value = ''
      } else {
        headerNode.textContent = 'Edit Group'
        nameInputNode.value = name
      }
      colorInputNode.value = color || '#77FF77'
      channelSelectNode.innerHTML = ''
      slack.getChannels().map(channel => {
        const optionNode = document.createElement('option')
        optionNode.value = channel.id
        optionNode.text = channel.name
        channelSelectNode.appendChild(optionNode)
      })
      return node
    }

    return {
      content
    }
  })()

  const style = (() => {
    const node = document.createElement('style')
    node.textContent = `
      * {
        box-sizing: border-box;
      }
      input,
      select {
        height: 2em;
        font-size: 1em;
        border: 1px solid #999999;
        border-radius: 0.3em;
      }
      input[type=text] {
        padding: 0 0.5em;
      }
      .modal {
        display: none;
        font-size: 1rem;
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
        padding: 1em 1em 0 1em;
        color: #333;
        background-color: white;
        border: 1px solid #444;
        border-radius: 0.5em;
        box-shadow: #555 0 0 10px;
        z-index: 1000001;
      }
      .modal h1 {
        font-size: 1.4em;
        font-weight: normal;
        margin:0 0 1em 0;
      }
      .group-configuration-form__row {
        display: flex;
        flex-direction: row;
        margin-bottom: 1em;
      }
      .group-configuration-form__name {
        flex-grow: 1;
        border-right-style: none;
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
      }
      .group-configuration-form__color {
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
      }
      .group-configuration-form__channels {
        flex-grow: 1;
        height: 10em;
        padding: 0.5em;
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
    modal,
    groupConfigurationForm,
    slack
  }
})()

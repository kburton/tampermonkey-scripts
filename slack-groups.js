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
    const teamIdSelector = '[data-teamid]'
    const channelNodesSelector = '[data-qa-channel-sidebar-channel-type=channel], [data-qa-channel-sidebar-channel-type=private]'

    const waitUntilReady = async () => {
      while (document.querySelector(teamIdSelector) === null) {
        await new Promise(resolve => requestAnimationFrame(resolve))
      }
    }

    const getTeamId = () => document.querySelector(teamIdSelector).dataset.teamid

    const getChannels = () => {
      const channelNodes = [...document.querySelectorAll(channelNodesSelector)]
      return channelNodes.map(node => ({
        id: node.dataset.qaChannelSidebarChannelId,
        name: node.innerText
      }))
    }

    return {
      waitUntilReady,
      getTeamId,
      getChannels
    }
  })()

  const state = (() => {
    const data = {
      groups: []
    }

    const groupUpdateListeners = []
    const selectionUpdateListeners = []

    const getStorageKey = () => {
      return `kburton/tampermonkey-scripts/slack-groups::${slack.getTeamId()}`
    }

    const init = () => {
      const fromStorage = window.localStorage.getItem(getStorageKey())
      if (fromStorage !== null) {
        const deserialized = JSON.parse(fromStorage)
        data.groups = deserialized.groups || []
      }
    }

    const registerGroupUpdateListener = onUpdate => {
      groupUpdateListeners.push(onUpdate)
    }

    const registerSelectionUpdateListener = onUpdate => {
      selectionUpdateListeners.push(onUpdate)
    }

    const notifyGroupUpdateListeners = () => {
      groupUpdateListeners.forEach(updateListener => updateListener())
    }

    const notifySelectionUpdateListeners = () => {
      selectionUpdateListeners.forEach(updateListener => updateListener())
    }

    const persist = () => {
      window.localStorage.setItem(getStorageKey(), JSON.stringify(data))
    }

    const getGroups = () => data.groups

    const addGroup = group => {
      data.groups.push(group)
      persist()
      notifyGroupUpdateListeners()
    }

    const updateGroup = (index, group) => {
      if (index >= 0 && index < data.groups.length) {
        data.groups[index] = group
        persist()
        notifyGroupUpdateListeners()
        notifySelectionUpdateListeners()
      }
    }

    const removeGroup = index => {
      if (index >= 0 && index < data.groups.length) {
        data.groups.splice(index, 1)
        persist()
        notifyGroupUpdateListeners()
        notifySelectionUpdateListeners()
      }
    }

    const toggleGroupSelection = index => {
      if (index >= 0 && index < data.groups.length) {
        data.groups[index].isSelected = !data.groups[index].isSelected
        persist()
        notifySelectionUpdateListeners()
      }
    }

    return {
      init,
      registerGroupUpdateListener,
      registerSelectionUpdateListener,
      getGroups,
      addGroup,
      updateGroup,
      removeGroup,
      toggleGroupSelection
    }
  })()

  const modal = (() => {
    let stack = []

    const closeButtonNode = document.createElement('div')
    closeButtonNode.className = 'modal__close'
    closeButtonNode.textContent = '✕'

    const contentNode = document.createElement('div')

    const dialogNode = document.createElement('div')
    dialogNode.className = 'modal__dialog'
    dialogNode.appendChild(closeButtonNode)
    dialogNode.appendChild(contentNode)

    const wrapperNode = document.createElement('div')
    wrapperNode.className = 'modal__wrapper'
    wrapperNode.appendChild(dialogNode)

    const node = document.createElement('div')
    node.className = 'modal'
    node.appendChild(wrapperNode)

    const render = () => {
      if (stack.length === 0) {
        node.className = 'modal'
      } else {
        contentNode.innerHTML = ''
        contentNode.appendChild(stack[stack.length - 1])
        node.className = 'modal modal--visible'
      }
    }

    const isShowing = () => stack.length > 0

    const show = (contentNode) => {
      stack.push(contentNode)
      render()
    }

    const hide = () => {
      stack.pop()
      render()
    }

    closeButtonNode.addEventListener('click', hide)

    return {
      node,
      isShowing,
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

    const controlsNode = document.createElement('div')
    controlsNode.className = 'group-configuration-form__controls'

    const node = document.createElement('div')
    node.className = 'group-configuration-form'
    node.appendChild(headerNode)
    node.appendChild(groupRowNode)
    node.appendChild(channelSelectRowNode)
    node.appendChild(controlsNode)

    const updateControlsNode = (onSubmit) => {
      const submitNode = document.createElement('input')
      submitNode.type = 'button'
      submitNode.className = 'group-configuration-form__submit'
      submitNode.value = 'Save'
      submitNode.addEventListener('click', onSubmit)

      const cancelNode = document.createElement('input')
      cancelNode.type = 'button'
      cancelNode.className = 'group-configuration-form__cancel'
      cancelNode.value = 'Cancel'
      cancelNode.addEventListener('click', modal.hide)

      controlsNode.innerHTML = ''
      controlsNode.appendChild(submitNode)
      controlsNode.appendChild(cancelNode)
    }

    const content = (groupIndex = undefined) => {
      const isNewGroup = groupIndex === undefined
      const group = isNewGroup ? {
        name: '',
        color: '#77FF77',
        channels: [],
        isSelected: false
      } : state.getGroups()[groupIndex]

      headerNode.textContent = isNewGroup ? 'Create Group' : 'Edit Group'
      nameInputNode.value = group.name
      colorInputNode.value = group.color

      channelSelectNode.innerHTML = ''
      slack.getChannels().map(channel => {
        const optionNode = document.createElement('option')
        optionNode.value = channel.id
        optionNode.text = channel.name
        optionNode.selected = group.channels.includes(channel.id)
        channelSelectNode.appendChild(optionNode)
      })

      updateControlsNode(() => {
        const updatedGroup = {
          name: nameInputNode.value,
          color: colorInputNode.value,
          channels: [...channelSelectNode.querySelectorAll('option:checked')].map(option => option.value),
          isSelected: group.isSelected
        }
        if (isNewGroup) {
          state.addGroup(updatedGroup)
        } else {
          state.updateGroup(groupIndex, updatedGroup)
        }
        modal.hide()
      })

      return node
    }

    return {
      content
    }
  })()

  const groupSelectionForm = (() => {
    const headerNode = document.createElement('h1')
    headerNode.textContent = 'Select Groups to Highlight'

    const addGroupNode = document.createElement('div')
    addGroupNode.className = 'group-selection-form__add-group'
    addGroupNode.textContent = '＋'
    addGroupNode.addEventListener('click', () => {
      modal.show(groupConfigurationForm.content())
    })

    const groupContainerNode = document.createElement('div')
    groupContainerNode.className = 'group-selection-form__group-container'

    const node = document.createElement('div')
    node.className = 'group-selection-form'
    node.appendChild(addGroupNode)
    node.appendChild(headerNode)
    node.appendChild(groupContainerNode)

    const content = () => {
      groupContainerNode.innerHTML = ''

      state.getGroups().forEach(({ name, color, isSelected }, index) => {
        const checkboxNode = document.createElement('input')
        checkboxNode.type = 'checkbox'
        checkboxNode.checked = isSelected
        checkboxNode.addEventListener('change', () => state.toggleGroupSelection(index))

        const nameNode = document.createElement('span')
        nameNode.textContent = name

        const labelNode = document.createElement('label')
        labelNode.style.borderBottom = `2px solid ${color}`
        labelNode.appendChild(checkboxNode)
        labelNode.appendChild(nameNode)

        const spacerNode = document.createElement('div')
        spacerNode.className = 'group-selection-form__group-spacer'

        const editNode = document.createElement('div')
        editNode.className = 'group-selection-form__group-button'
        editNode.textContent = 'Edit'
        editNode.addEventListener('click', () => {
          modal.show(groupConfigurationForm.content(index))
        })

        const deleteNode = document.createElement('div')
        deleteNode.className = 'group-selection-form__group-button'
        deleteNode.textContent = 'Delete'
        deleteNode.addEventListener('click', () => {
          if (window.confirm(`Delete group '${name}'?`)) {
            state.removeGroup(index)
          }
        })

        const rowNode = document.createElement('div')
        rowNode.className = 'group-selection-form__group'
        rowNode.appendChild(labelNode)
        rowNode.appendChild(spacerNode)
        rowNode.appendChild(editNode)
        rowNode.appendChild(deleteNode)

        groupContainerNode.appendChild(rowNode)
      })

      return node
    }

    state.registerGroupUpdateListener(content)

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
      .modal__close {
        position: absolute;
        top: 0;
        right: 0;
        font-size: 1.6em;
        padding: 0.2em 0.5em;
        cursor: pointer;
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
      .group-configuration-form__controls {
        margin-bottom: 1em;
        text-align:right;
      }
      .group-configuration-form__controls input {
        cursor: pointer;
      }
      .group-configuration-form__submit {
        margin-right: 0.5em;
      }
      .group-selection-form__group-container {
        margin-bottom: 1em;
      }
      .group-selection-form__add-group {
        position: absolute;
        top: 0;
        right: 1em;
        font-size: 1.8em;
        padding: 0.1em 0.5em;
        color: #007700;
        cursor: pointer;
      }
      .group-selection-form__group-container label {
        display: inline-block;
        vertical-align: middle;
      }
      .group-selection-form__group-container label * {
        vertical-align: middle;
        margin-right: 0.5em;
      }
      .group-selection-form__group {
        display: flex;
        flex-direction: row;
        align-items: center;
      }
      .group-selection-form__group:hover {
        background-color: #EEEEEE;
      }
      .group-selection-form__group-spacer {
        flex-grow: 1;
      }
      .group-selection-form__group-button {
        margin-right: 0.5em;
        cursor: pointer;
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

  const eventHandlers = (() => {
    const bindKeyDown = () => {
      let shiftCount = 0
      document.addEventListener('keydown', e => {
        const isEscape = e.code === 'Escape'
        const isShift = e.code.substring(0, 5) === 'Shift'
        shiftCount = isShift && !modal.isShowing() ? shiftCount + 1 : 0

        if (shiftCount >= 3) {
          shiftCount = 0
          modal.show(
            state.getGroups().length === 0 ? groupConfigurationForm.content() : groupSelectionForm.content()
          )
        }

        if (isEscape) {
          modal.hide()
        }
      })
    }

    const init = () => {
      bindKeyDown()
    }

    return {
      init
    }
  })()

  slack.waitUntilReady().then(() => {
    document.body.appendChild(root.node)
    state.init()
    eventHandlers.init()
    console.log(`Tampermonkey Slack Groups initialized for Slack team ${slack.getTeamId()}`)
  })

  window.slackGroups = {
    modal,
    groupConfigurationForm,
    slack
  }
})()

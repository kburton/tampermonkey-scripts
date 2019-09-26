// ==UserScript==
// @name         Slack Groups
// @namespace    https://www.kappasoft.net/
// @version      0.2
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
      groups: [],
      muteUnselectedChannels: true
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
        data.muteUnselectedChannels = deserialized.muteUnselectedChannels
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

    const clearGroupSelection = () => {
      data.groups.forEach(group => {
        group.isSelected = false
        persist()
        notifySelectionUpdateListeners()
      })
    }

    const getMuteUnselectedChannels = () => data.muteUnselectedChannels

    const toggleMuteUnselectedChannels = () => {
      data.muteUnselectedChannels = !data.muteUnselectedChannels
      persist()
      notifySelectionUpdateListeners()
    }

    return {
      init,
      registerGroupUpdateListener,
      registerSelectionUpdateListener,
      getGroups,
      addGroup,
      updateGroup,
      removeGroup,
      toggleGroupSelection,
      getMuteUnselectedChannels,
      toggleMuteUnselectedChannels,
      clearGroupSelection
    }
  })()

  const icons = (() => {
    const svgNs = 'http://www.w3.org/2000/svg'

    const createBaseSvg = (className) => {
      const svg = document.createElementNS(svgNs, 'svg')
      svg.setAttribute('class', className)
      svg.setAttribute('viewBox', '0 0 12 12')
      return svg
    }

    const createLine = (x1, y1, x2, y2) => {
      const line = document.createElementNS(svgNs, 'line')
      line.setAttribute('x1', x1.toString())
      line.setAttribute('y1', y1.toString())
      line.setAttribute('x2', x2.toString())
      line.setAttribute('y2', y2.toString())
      line.setAttribute('stroke-width', '2')
      line.setAttribute('stroke-linecap', 'round')
      return line
    }

    const close = () => {
      const svg = createBaseSvg('icon icon--close')
      svg.appendChild(createLine(1, 1, 11, 11))
      svg.appendChild(createLine(1, 11, 11, 1))
      return svg
    }

    const add = () => {
      const svg = createBaseSvg('icon icon--add')
      svg.appendChild(createLine(1, 6, 11, 6))
      svg.appendChild(createLine(6, 1, 6, 11))
      return svg
    }

    const edit = () => {
      const svg = createBaseSvg('icon icon--edit')
      svg.appendChild(createLine(1, 11, 2, 8))
      svg.appendChild(createLine(2, 8, 9, 1))
      svg.appendChild(createLine(9, 1, 11, 3))
      svg.appendChild(createLine(11, 3, 4, 10))
      svg.appendChild(createLine(4, 10, 1, 11))
      return svg
    }

    const remove = () => {
      const svg = createBaseSvg('icon icon--remove')
      svg.appendChild(createLine(2, 2, 4, 11))
      svg.appendChild(createLine(4, 11, 8, 11))
      svg.appendChild(createLine(8, 11, 10, 2))
      svg.appendChild(createLine(1, 2, 11, 2))
      svg.appendChild(createLine(5, 1, 7, 1))
      return svg
    }

    return {
      close,
      add,
      edit,
      remove
    }
  })()

  const modal = (() => {
    let stack = []

    const closeButtonNode = document.createElement('div')
    closeButtonNode.className = 'modal__close'
    closeButtonNode.appendChild(icons.close())

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

        const firstInput = contentNode.querySelector('input')
        if (firstInput) {
          window.setTimeout(() => firstInput.focus(), 0)
        }
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

    closeButtonNode.addEventListener('click', e => {
      e.preventDefault()
      e.stopPropagation()
      hide()
    })

    dialogNode.addEventListener('click', e => {
      e.stopPropagation()
    })

    node.addEventListener('click', e => {
      e.preventDefault()
      e.stopPropagation()
      hide()
    })

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

    const shortcutInputNode = document.createElement('input')
    shortcutInputNode.className = 'group-configuration-form__shortcut'
    shortcutInputNode.type = 'text'
    shortcutInputNode.placeholder = 'Shortcut key'
    shortcutInputNode.addEventListener('keypress', e => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key.match(/^[a-z0-9]$/i)) {
        shortcutInputNode.value = e.key.toLowerCase()
      }
    })

    const shortcutHintNode = document.createElement('div')
    shortcutHintNode.textContent = 'Key to activate the group when the modal is open (optional)'

    const shortcutRowNode = document.createElement('div')
    shortcutRowNode.className = 'group-configuration-form__row'
    shortcutRowNode.appendChild(shortcutInputNode)
    shortcutRowNode.appendChild(shortcutHintNode)

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
    node.appendChild(shortcutRowNode)
    node.appendChild(channelSelectRowNode)
    node.appendChild(controlsNode)

    const updateControlsNode = (onSubmit) => {
      const submitNode = document.createElement('input')
      submitNode.type = 'button'
      submitNode.className = 'group-configuration-form__submit'
      submitNode.value = 'Save'
      submitNode.addEventListener('click', e => {
        e.preventDefault()
        e.stopPropagation()
        onSubmit()
      })

      const cancelNode = document.createElement('input')
      cancelNode.type = 'button'
      cancelNode.className = 'group-configuration-form__cancel'
      cancelNode.value = 'Cancel'
      cancelNode.addEventListener('click', e => {
        e.preventDefault()
        e.stopPropagation()
        modal.hide()
      })

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
        shortcut: '',
        isSelected: false
      } : state.getGroups()[groupIndex]

      headerNode.textContent = isNewGroup ? 'Create Group' : 'Edit Group'
      nameInputNode.value = group.name
      colorInputNode.value = group.color
      shortcutInputNode.value = group.shortcut

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
          shortcut: shortcutInputNode.value,
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
    addGroupNode.appendChild(icons.add())
    addGroupNode.addEventListener('click', e => {
      e.preventDefault()
      e.stopPropagation()
      modal.show(groupConfigurationForm.content())
    })

    const groupContainerNode = document.createElement('div')
    groupContainerNode.className = 'group-selection-form__group-container'

    const muteUnselectedCheckboxNode = document.createElement('input')
    muteUnselectedCheckboxNode.type = 'checkbox'
    muteUnselectedCheckboxNode.addEventListener('change', e => {
      e.preventDefault()
      e.stopPropagation()
      state.toggleMuteUnselectedChannels()
    })

    const muteUnselectedDescriptionNode = document.createElement('span')
    muteUnselectedDescriptionNode.textContent = 'Mute unselected channels'

    const muteUnselectedLabelNode = document.createElement('label')
    muteUnselectedLabelNode.className = 'group-selection-form__mute'
    muteUnselectedLabelNode.appendChild(muteUnselectedCheckboxNode)
    muteUnselectedLabelNode.appendChild(muteUnselectedDescriptionNode)

    const node = document.createElement('div')
    node.className = 'group-selection-form'
    node.appendChild(addGroupNode)
    node.appendChild(headerNode)
    node.appendChild(groupContainerNode)
    node.appendChild(muteUnselectedLabelNode)

    node.addEventListener('keypress', e => {
      const key = e.key.toLowerCase()
      const matchingGroupIndexes = state.getGroups()
        .map(({ shortcut }, index) => ({ shortcut, index }))
        .filter(group => group.shortcut === key)
        .map(group => group.index)

      if (matchingGroupIndexes.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        state.clearGroupSelection()
        matchingGroupIndexes.forEach(index => {
          state.toggleGroupSelection(index)
        })
        modal.hide()
      }
    })

    node.addEventListener('keydown', e => {
      if (['Backspace', 'Delete'].includes(e.code)) {
        e.preventDefault()
        e.stopPropagation()
        state.clearGroupSelection()
        modal.hide()
      }
    })

    const content = () => {
      groupContainerNode.innerHTML = ''

      muteUnselectedCheckboxNode.checked = state.getMuteUnselectedChannels()

      if (state.getGroups().length === 0) {
        const noGroupsNode = document.createElement('div')
        noGroupsNode.textContent = 'You haven\'t created any channel groups yet. Click the green plus button to get started.'
        groupContainerNode.appendChild(noGroupsNode)
      }

      state.getGroups()
        .map(({ name, color, shortcut, isSelected }, index) => ({ name, color, shortcut, isSelected, index }))
        .sort((group1, group2) => group1.name.toLowerCase() < group2.name.toLowerCase() ? -1 : 1)
        .forEach(({ name, color, shortcut, isSelected, index }) => {
          const checkboxNode = document.createElement('input')
          checkboxNode.type = 'checkbox'
          checkboxNode.checked = isSelected
          checkboxNode.addEventListener('change', e => {
            e.preventDefault()
            e.stopPropagation()
            state.toggleGroupSelection(index)
          })

          const nameNode = document.createElement('span')
          nameNode.textContent = name

          const labelNode = document.createElement('label')
          labelNode.className = 'group-selection-form__group-label'
          labelNode.style.borderBottom = `2px solid ${color}`
          labelNode.appendChild(checkboxNode)
          labelNode.appendChild(nameNode)

          const shortcutNode = document.createElement('span')
          shortcutNode.className = 'group-selection-form__group-shortcut'
          shortcutNode.textContent = shortcut ? `[ ${shortcut} ]` : ''

          const spacerNode = document.createElement('div')
          spacerNode.className = 'group-selection-form__group-spacer'

          const editNode = document.createElement('div')
          editNode.className = 'group-selection-form__group-button'
          editNode.appendChild(icons.edit())
          editNode.addEventListener('click', e => {
            e.preventDefault()
            e.stopPropagation()
            modal.show(groupConfigurationForm.content(index))
          })

          const removeNode = document.createElement('div')
          removeNode.className = 'group-selection-form__group-button'
          removeNode.appendChild(icons.remove())
          removeNode.addEventListener('click', e => {
            e.preventDefault()
            e.stopPropagation()
            if (window.confirm(`Delete group '${name}'?`)) {
              state.removeGroup(index)
            }
          })

          const rowNode = document.createElement('div')
          rowNode.className = 'group-selection-form__group'
          rowNode.appendChild(labelNode)
          rowNode.appendChild(shortcutNode)
          rowNode.appendChild(spacerNode)
          rowNode.appendChild(editNode)
          rowNode.appendChild(removeNode)

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
        top: 1em;
        right: 1em;
      }
      .modal h1 {
        font-size: 1.4em;
        font-weight: normal;
        margin:0 0 1em 0;
      }
      .icon {
        display: block;
        stroke: currentColor;
        height: 1em;
        width: 1em;
        cursor: pointer;
      }
      .icon:hover {
        opacity: 0.7;
      }
      .icon--add {
        stroke: #009900;
        height: 1.2em;
        width: 1.2em;
      }
      .icon--edit {
        stroke: #333333;
      }
      .icon--remove {
        stroke: #B72D2D;
      }
      .group-configuration-form__row {
        display: flex;
        flex-direction: row;
        align-items: center;
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
      .group-configuration-form__shortcut {
        width: 7em;
        margin-right: 0.5em;
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
        bottom: 1em;
        right: 1em;
      }
      .group-selection-form__group-label {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding-right: 0.3em;
      }
      .group-selection-form__group-label input {
        margin-right: 0.5em;
      }
      .group-selection-form__group-shortcut {
        color: #888888;
        font-weight: bold;
        margin: 0 0 2px 0.7em
      }
      .group-selection-form__group {
        display: flex;
        flex-direction: row;
        align-items: center;
        margin: 0 -1em;
        padding: 0 1em;
      }
      .group-selection-form__group:hover {
        background-color: #EEEEEE;
      }
      .group-selection-form__group-spacer {
        flex-grow: 1;
      }
      .group-selection-form__group-button {
        opacity: 0.2;
        margin-left: 0.5em;
      }
      .group-selection-form__group:hover .group-selection-form__group-button {
        opacity: 1;
      }
      .group-selection-form__mute {
        display: flex;
        flex-direction: row;
        align-items: center;
        margin-bottom: 0.4em;
        font-style: italic;
        color: #555;
      }
      .group-selection-form__mute input {
        margin-right: 0.5em;
      }
    `

    return {
      node
    }
  })()

  const slackStyle = (() => {
    const node = document.createElement('style')

    const update = () => {
      const selectedGroups = state.getGroups().filter(group => group.isSelected)

      const cssRules = []

      if (selectedGroups.length > 0 && state.getMuteUnselectedChannels()) {
        const publicChannelSelector = '[data-qa-channel-sidebar-channel-type="channel"] span'
        const privateChannelSelector = '[data-qa-channel-sidebar-channel-type="private"] span'
        const activeChannelSelector = '[data-qa-channel-sidebar-channel-is-selected="true"] span'

        cssRules.push(`${publicChannelSelector}, ${privateChannelSelector} { opacity: 0.2 !important; }`)
        cssRules.push(`${activeChannelSelector} { opacity: 1 !important; }`)
      }

      selectedGroups.forEach(group => {
        const channelSelector = group.channels.map(channel =>
          `[data-qa-channel-sidebar-channel-id="${channel}"] span`
        ).join(', ')
        const channelNameSelector = group.channels.map(channel =>
          `[data-qa-channel-sidebar-channel-id="${channel}"] span:first-child`
        ).join(', ')
        cssRules.push(`${channelSelector} { opacity: 1 !important; }`)
        cssRules.push(`${channelNameSelector} { color: ${group.color} !important; }`)
      })

      node.textContent = cssRules.join('\n')
    }

    state.registerSelectionUpdateListener(update)

    return {
      node,
      update
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
          modal.show(groupSelectionForm.content())
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
    document.body.appendChild(slackStyle.node)
    state.init()
    slackStyle.update()
    eventHandlers.init()
    console.log(`Tampermonkey Slack Groups initialized for Slack team ${slack.getTeamId()}`)
  })
})()

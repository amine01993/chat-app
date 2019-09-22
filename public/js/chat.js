(function () {

    const socket = io()
    const parser = new DOMParser()
    const connectedUserId = document.getElementById('connected-user').value

    const channelItemTemplate = `<li class="collection-item avatar">
        <div class="badged-circle">
            <img class="circle" alt="avatar">
        </div>
        <div class="title"></div>
        <div class="sub-title"></div>
        <div class="last-msg-date"></div>
    </li>`

    const channelsList = document.getElementById('channels-list')
    const chatCard = document.getElementById('chat-card')
    const chatWith = chatCard.querySelector('.card-title')
    const chatHistoryList = chatCard.querySelector('.chat-wrapper')
    const addGroupContainer = chatCard.querySelector('.add-group-container')
    const addGroupAction = document.getElementById('add-group-action')
    const msgForm = chatCard.querySelector('#message-form')
    const msgInput = chatCard.querySelector('#message-input')

    const messageTemplate = `<div class="chat-message">
        <img class="circle" src="//cdn.shopify.com/s/files/1/1775/8583/t/1/assets/portrait1.jpg?0" alt="avatar">
        <span class="message">
            Lo-fi you probably haven't heard of them etsy leggings raclette kickstarter four dollar toast. 
            Raw denim
        </span>
    </div>`
    
    const chatDateTemplate = `<div class="chat-date">
    </div>`

    const channelsConnectionStatus = [] // {channel_uuid, connected}

    const addGroupAutoComplete = document.querySelectorAll('.add-group-container .chips')
    const addGroupInst = M.Chips.init(addGroupAutoComplete, {
        placeholder: 'Add users to join this conversation',
        autocompleteOptions: {
            data: {}
        }
    })[0]

    function getChatPicture(chatPicture, gender) {
        return chatPicture != null && chatPicture != '' 
            ? `img/${chatPicture}` 
            : `default-img/${gender == 'female' ? 'default-female-icon.png' : 'default-icon.png'}`
    }

    function addMessage({user_id, msg, chatPicture, sex, created_at}) {

        const dateMoment = moment(new Date(created_at))
        if(prev_day == null || prev_day != dateMoment.format('DDMMYYYY')) {
            prev_day = dateMoment.format('DDMMYYYY')
            const dayDate = parser.parseFromString(chatDateTemplate, 'text/html').body.firstChild
            dayDate.innerHTML = dateMoment.format('DD/MM/YYYY HH:mm')
            chatHistoryList.appendChild(dayDate)
        }

        const messageElem = parser.parseFromString(messageTemplate, 'text/html').body.firstChild
        
        const textMessage = messageElem.querySelector('.message')
        textMessage.innerText = msg
        textMessage.classList.add('tooltipped')
        textMessage.setAttribute('data-tooltip', moment(new Date(created_at)).format('MMM D, YYYY [at] HH:mm'))

        if(user_id == connectedUserId) {
            messageElem.classList.add('right')
            textMessage.setAttribute('data-position', 'left')
        }
        else {
            textMessage.setAttribute('data-position', 'right')
        }

        M.Tooltip.init(textMessage, {})

        if(user_id == prev_user_id) {
            messageElem.classList.add('coalesce')
            messageElem.removeChild(messageElem.querySelector('img.circle'))
        }
        else {
            messageElem.querySelector('img.circle').src = getChatPicture(chatPicture, sex)
        }
        prev_user_id = user_id
        
        chatHistoryList.appendChild(messageElem)
    }

    function setConnectionStatus(channel_uuid, connected) {
        const ccs = channelsConnectionStatus.find(c => c.channel_uuid == channel_uuid)
        if(ccs) {
            ccs.connected = connected
        }
        else {
            channelsConnectionStatus.push({
                channel_uuid: channel_uuid,
                connected
            })
        }
    }

    function updateConnectionStatus(channel_uuid, lastConnection) {
        if(channelsConnectionStatus.find(c => c.channel_uuid == channel_uuid && c.connected)) {
            chatCard.querySelector('.connection-status').innerHTML = 'Currently Online'
        }
        else {
            if(lastConnection) {
                chatCard.querySelector('.connection-status').innerHTML = `Last Connection at ${moment(new Date(lastConnection)).format('DD/MM/YYYY HH:mm')}`
            }
            else {
                chatCard.querySelector('.connection-status').innerHTML = ''
            }
        }
    }

    function updateAddGroup(acUsers) {
        // clear chips data
        addGroupInst.chipsData = []
        addGroupInst._renderChips()

        addGroupAction.classList.remove('hide')

        ac_users = acUsers.reduce((accumulator, currentValue) => Object.assign(accumulator, {[currentValue.username]: currentValue.id}), {})
        console.log('ac_users', ac_users)
        addGroupInst.autocomplete.updateData(
            acUsers.reduce((accumulator, currentValue) => Object.assign(accumulator, {[currentValue.username]: null}), {})
        )
    }

    socket.on('channels', channels => {
        console.log(channels)

        channelsList.innerHTML = ''
        for (let index = 0; index < channels.length; index++) {
            const {
                channel_uuid,
                body, sender_id, created_at,
                users,
                connectionStatus
            } = channels[index]

            const channelItem = parser.parseFromString(channelItemTemplate, 'text/html').body.firstChild
            const otherUsers = users.filter(u => users.length == 1 || u.user_id != connectedUserId)
            const otherUsernames = `${otherUsers.map(u => u.username).join(', ')}`
            channelItem.querySelector('.title').innerText = otherUsernames
            if(body) {
                let subtitle = ''
                if(users.length > 1 && sender_id == connectedUserId) {
                    subtitle += 'You: '
                }
                else if(users.length > 2) {
                    subtitle += users.find(u => u.user_id == sender_id).username
                }
                subtitle += body
                channelItem.querySelector('.sub-title').innerText = subtitle
                channelItem.querySelector('.last-msg-date').innerText = moment(new Date(created_at)).format('DD/MM/YYYY HH:mm')
            }

            if(connectionStatus) {
                channelItem.querySelector('.badged-circle').classList.add('online')
            }
            setConnectionStatus(channel_uuid, connectionStatus)
            
            if(otherUsers.length > 1) {
                channelItem.querySelector('.badged-circle').classList.add('group-picture')
            }
            otherUsers.slice(0, 2).forEach((u, i, arr) => {
                const {chatPicture, gender} = u
                if(i == 0) {
                    const img = channelItem.querySelector('img.circle')
                    img.src = getChatPicture(chatPicture, gender)
                }
                else {
                    const img = document.createElement('img')
                    img.src = getChatPicture(chatPicture, gender)
                    img.classList.add('circle')
                    img.alt = 'avatar'
                    channelItem.querySelector('.badged-circle').appendChild(img)
                }
            })
            channelItem.setAttribute('data-channel_uuid', channel_uuid) // existing or temporary
            channelItem.setAttribute('data-users', users.map(u => u.user_id).join('-'))

            channelItem.addEventListener('click', (event) => {
                channelsList.querySelectorAll('li.collection-item').forEach(li => {
                    li.classList.remove('active')
                })
                channelItem.classList.add('active')

                let c_uuid = channelItem.getAttribute('data-channel_uuid')

                console.log('a click, channel_uuid: ', c_uuid)
                prev_user_id = null
                socket.emit('chat', {
                    userIds: users.map(u => u.user_id),
                    channel_uuid: c_uuid,
                })
            })
            channelsList.appendChild(channelItem)
        }

        if(selected_channel_uuid) {
            const channelElem = channelsList.querySelector(`[data-channel_uuid='${selected_channel_uuid}']`)
            channelElem.classList.add('active')
        }
    })

    let prev_user_id = null, prev_day = null, ac_users = null
    socket.on('chat', ({channel_uuid, users, messages, channel_item_id, acUsers}) => {
        console.log('chat', {channel_uuid, users, messages, channel_item_id})

        chatWith.innerHTML = `Chat with ${users.filter(u => users.length == 1 || u.user_id != connectedUserId).map(u => u.username).join(', ')}`
        
        const _users = users.filter(u => (users.length == 1 || u.user_id != connectedUserId) && u.lastConnection)
        let lastConnection = null
        if(_users.length > 0) {
            const _user = _users.sort((la, lb) => la.lastConnection <= lb.lastConnection ? 1 : -1)[0]
            lastConnection = _user.lastConnection
        }
        updateConnectionStatus(channel_uuid, lastConnection)

        // update channelItem id
        if(channel_item_id) {
            const channelItem = document.querySelector(`[data-channel_uuid=${channel_item_id}]`)
            channelItem.setAttribute('data-channel_uuid', channel_uuid)
        }

        chatHistoryList.innerHTML = ''

        selected_channel_uuid = channel_uuid
        prev_day = null
        for (let mi = 0; mi < messages.length; mi++) {
            addMessage(messages[mi])
        }

        // update addGroup AutoComplete
        updateAddGroup(acUsers)
    })

    socket.on('updateAddGroup', (acUsers) => {
        updateAddGroup(acUsers)
    })

    let selected_channel_uuid = null
    msgForm.addEventListener('submit', (event) => {
        event.preventDefault()
        console.log('socket client emit on ', selected_channel_uuid, msgInput.value)

        if(selected_channel_uuid && msgInput.value.trim() != '') {
            socket.emit('handleMessage', {
                channel_uuid: selected_channel_uuid,
                value: msgInput.value,
            })
            msgInput.value = ''
        }
    })

    socket.on('messageListener', data => {
        console.log(data)
        addMessage(data.msg)
    })

    socket.on('connectionStatusListener', ({user_id, connected, lastConnection}) => {
        console.log('connectionStatusListener', user_id)
        // if one user is connected then the channel is online
        Array.from(channelsList.querySelectorAll(`.collection-item`))
        .filter(elem => {
            return elem.getAttribute('data-users').split('-').includes(user_id.toString())
        })
        .map(elem => {
            console.log(elem)
            const elembc = elem.querySelector('.badged-circle')

            if(connected) {
                elembc.classList.add('online')
            }
            else {
                elembc.classList.remove('online')
            }
            const channel_uuid = elem.getAttribute('data-channel_uuid')
            setConnectionStatus(channel_uuid, connected ? true : false)

            if(selected_channel_uuid == channel_uuid) {
                updateConnectionStatus(channel_uuid, lastConnection)
            }
        })
    })

    addGroupAction.addEventListener('click', event => {
        addGroupContainer.classList.toggle('hide')
    })

    document.getElementById('add-users-btn').addEventListener('click', event => {
        console.log(addGroupInst)
        console.log(addGroupInst.chipsData)
        console.log(selected_channel_uuid)

        if(!selected_channel_uuid)
            return
        
        const users = addGroupInst.chipsData.map(c => ac_users[c.tag])
        console.log(users)
        socket.emit('addUsersToChannel', {
            users,
            channel_uuid: selected_channel_uuid
        })
    })

    socket.on('updateChannels')
})();
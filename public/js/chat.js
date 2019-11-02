(function () {

    const socket = io()
    const uploader = new SocketIOFileClient(socket)

    const parser = new DOMParser()
    const connectedUserId = document.getElementById('connected-user').value
    const uploads = {}

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
    const msgSend = chatCard.querySelector('#send-message')
    const msgInput = chatCard.querySelector('#message-input')
    const uploadFile = chatCard.querySelector('#upload-file')
    const uploadFileInput = document.getElementById('upload-file-input')
    const attachmentFiles = chatCard.querySelector('.message-attachments-list')

    const messageTemplate = `<div class="chat-message">
        <img class="circle" src="//cdn.shopify.com/s/files/1/1775/8583/t/1/assets/portrait1.jpg?0" alt="avatar">
        <div class="message">
            Lo-fi you probably haven't heard of them etsy leggings raclette kickstarter four dollar toast. 
            Raw denim
        </div>
    </div>`

    const chatDateTemplate = `<div class="chat-date">
    </div>`

    const attachmentUploadTemplate = `<li class="message-attachment-item">
        <i class="material-icons">insert_drive_file</i>
        <div class="message-attachment-filename" title="file name 0123.jpg">
            file name 0123.jpg
        </div>
        <div class="progress">
            <div class="determinate" style="width: 0%"></div>
        </div>
    </li>`

    const attachmentImagePreviewTemplate = `<li class="message-attachment-item img-attachment">
        <div class="message-attachment-preview">
            <a href="javascript:;" class="close-preview">
                <i class="material-icons">close</i>
            </a>
            <img src="img/096a4729-61a8-4aee-8970-574032421aa9-chat.webp" alt="IMAGE">
        </div>
    </li>`

    const attachmentFilePreviewTemplate = `<li class="message-attachment-item file-attachment">
        <div class="message-attachment-preview file-preview">
            <div class="blue">
                <i class="material-icons">insert_drive_file</i>
            </div>
            <div>
                <h4 class="file-type-preview">html</h4>
                <p class="file-name-preview" title="projectdata.html">projectData-werewr.html</p>
            </div>
            <a href="javascript:;" class="close-preview">
                <i class="material-icons">close</i>
            </a>
        </div>
    </li>`

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

    function addMessage({user_id, msg, files, chatPicture, sex, created_at}) {

        const dateMoment = moment(new Date(created_at))
        if(prev_day == null || prev_day != dateMoment.format('DDMMYYYY')) {
            prev_day = dateMoment.format('DDMMYYYY')
            const dayDate = parser.parseFromString(chatDateTemplate, 'text/html').body.firstChild
            dayDate.innerHTML = dateMoment.format('DD/MM/YYYY HH:mm')
            chatHistoryList.appendChild(dayDate)
        }

        // txt message
        const messageElem = parser.parseFromString(messageTemplate, 'text/html').body.firstChild
        const textMessage = messageElem.querySelector('.message')
        textMessage.innerHTML = msg
        textMessage.classList.add('tooltipped')
        textMessage.setAttribute('data-tooltip', moment(new Date(created_at)).format('MMM D, YYYY [at] HH:mm'))

        const fileList = parser.parseFromString(`<div class="message-files"></div>`, 'text/html').body.firstChild
        files.forEach(file => {
            if(file) {
                if(/^image/i.test(file.type)) {
                    const imgElem = parser.parseFromString(`<div class='message'>
                        <img class="download-image" src="${'attachments/' + file.fileName}" alt="${file.originalFileName}">
                    </div>`, 'text/html').body.firstChild
                    fileList.appendChild(imgElem)
                }
                else {
                    const fileElem = parser.parseFromString(`<div class='message'>
                        <a href="${'attachments/' + file.fileName}" class="download-file" target="_blank">
                            ${file.originalFileName}
                        </a>
                    </div>`, 'text/html').body.firstChild
                    fileList.appendChild(fileElem)
                }
            }
        })
        fileList.classList.add('tooltipped')
        fileList.setAttribute('data-tooltip', moment(new Date(created_at)).format('MMM D, YYYY [at] HH:mm'))

        if(user_id == connectedUserId) {
            messageElem.classList.add('right')
            textMessage.setAttribute('data-position', 'left')
            fileList.setAttribute('data-position', 'left')
        }
        else {
            textMessage.setAttribute('data-position', 'right')
            fileList.setAttribute('data-position', 'right')
        }

        M.Tooltip.init(textMessage, {})
        M.Tooltip.init(fileList, {})

        if(user_id == prev_user_id) {
            messageElem.classList.add('coalesce')
            messageElem.removeChild(messageElem.querySelector('img.circle'))
        }
        else {
            messageElem.querySelector('img.circle').src = getChatPicture(chatPicture, sex)
        }
        prev_user_id = user_id
        
        if(files.length > 0) messageElem.appendChild(fileList)
        if(msg == '') {
            messageElem.removeChild(textMessage)
        }

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

    function initMessageInput() {
        // Emojis
        emojione.ascii = true

        const combination = new RegExp(emojione.regAscii.source + '|' + emojione.regShortNames.source, 'g')

        function emojify(elArg) {

            function placeCaretAtEnd(el, moveTo) {
                el.focus()
                if (typeof window.getSelection != "undefined" &&
                    typeof document.createRange != "undefined") {
                    const range = document.createRange()
                    range.setStartBefore(moveTo)
                    range.collapse(false)
                    const sel = window.getSelection()
                    sel.removeAllRanges()
                    sel.addRange(range)
                }
            }

            elArg.childNodes.forEach(node => {

                const matches = node.textContent.match(combination)
                let emo = null
                if (matches) {
                    for(let i = 0; i < matches.length; i++) {
                        const match = matches[i]
                        const start = node.textContent.indexOf(match)
                        const end = node.textContent.indexOf(match) + match.length
            
                        const stringToConvert = node.textContent.slice(start, end)
            
                        const temp_container = document.createElement('div')
                        temp_container.innerHTML = emojione.toImage(stringToConvert)
            
                        emo = temp_container.querySelector('.emojione') || temp_container.firstChild
            
                        const beforeText = document.createTextNode(node.textContent.slice(0, start))
                        const afterText = document.createTextNode(node.textContent.slice(end))
            
                        node.parentNode.insertBefore(beforeText, node)
                        node.parentNode.insertBefore(afterText, node.nextSibling)
                        node.parentNode.replaceChild(emo, node)

                        node = afterText
                    }
                    if(emo) {
                        placeCaretAtEnd(elArg, emo.nextSibling)
                    }
                }
            })
        }

        function removeOuterStyle(html) {
            for(const child of html.children) {
                if(!['emojione'].some(c => child.classList.contains(c))) {
                    child.setAttribute('style', '')
                    child.className = ''
                }
                removeOuterStyle(child)
            }
        }

        msgInput.addEventListener('input', () => {
            emojify(msgInput)
            removeOuterStyle(msgInput)
            resizeChatLayout()
        })

        // File attachments upload
        uploadFile.addEventListener('click', event => {
            uploadFileInput.click()
        })

        uploadFileInput.addEventListener('change', event => {
            console.log(uploadFileInput.files)
            if (uploadFileInput.files && uploadFileInput.files.length > 0) {
                console.log('true')
                const uploadIds = uploader.upload(uploadFileInput, {
                    data: { /* Arbitrary data... */ }
                })
                // setTimeout(function() {
                //     uploader.abort(uploadIds[0]);
                //     console.log(uploader.getUploadInfo());
                // }, 1000);            
            }
        })

        uploader.on('start', function(fileInfo) {
            console.log('Start uploading', fileInfo)

            const attachmentUpload = parser.parseFromString(attachmentUploadTemplate, 'text/html').body.firstChild
            const msgAttachFilename = attachmentUpload.querySelector('.message-attachment-filename')
            msgAttachFilename.innerText = fileInfo.name
            msgAttachFilename.setAttribute('title', fileInfo.name)

            uploads[fileInfo.uploadId] = {
                elem: attachmentUpload,
                temp: true
            }

            attachmentFiles.appendChild(attachmentUpload)
            resizeChatLayout()
        })
        uploader.on('stream', function(fileInfo) {
            console.log('Streaming... sent ' + fileInfo.sent + ' bytes.')
            uploads[fileInfo.uploadId].elem.querySelector('.determinate').style.width = `${fileInfo.sent / fileInfo.size}%`
        })
        uploader.on('complete', function(fileInfo) {
            console.log('Upload Complete', fileInfo)

            uploads[fileInfo.uploadId].elem.querySelector('.determinate').style.width = `100%`
            uploads[fileInfo.name] = uploads[fileInfo.uploadId]
            delete uploads[fileInfo.uploadId]
        })
        uploader.on('error', function(err) {
            console.log('Error!', err)
        })
        uploader.on('abort', function(fileInfo) {
            console.log('Aborted: ', fileInfo)
            delete uploads[fileInfo.uploadId]
        })        
    }

    function resizeChatLayout() {
        chatCard.style.gridTemplateRows = `88px calc(100vh - 88px - 1px - ${msgForm.offsetHeight}px) ${msgForm.offsetHeight}px`
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
                channelItem.querySelector('.sub-title').innerHTML = subtitle
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
                const {chatPicture, sex} = u
                if(i == 0) {
                    const img = channelItem.querySelector('img.circle')
                    img.src = getChatPicture(chatPicture, sex)
                }
                else {
                    const img = document.createElement('img')
                    img.src = getChatPicture(chatPicture, sex)
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

        const lastChatMsg = chatHistoryList.querySelector('.chat-message:last-child') 
        if(lastChatMsg) {
            lastChatMsg.scrollIntoView(true)
        }

        // update addGroup AutoComplete
        updateAddGroup(acUsers)
    })

    socket.on('updateAddGroup', (acUsers) => {
        updateAddGroup(acUsers)
    })

    socket.on('uploadComplete', ({id, imageUrl, originalFileName, fileName, type}) => {
        // show preview (images, other files)
        let attachmentPreview
        if(/^image/i.test(type)) {
            attachmentPreview = parser.parseFromString(attachmentImagePreviewTemplate, 'text/html').body.firstChild
            const previewImg = attachmentPreview.querySelector('img')
            previewImg.src = imageUrl
            previewImg.setAttribute('alt', originalFileName)
            attachmentPreview.setAttribute('data-id', id)
        }
        else {
            attachmentPreview = parser.parseFromString(attachmentFilePreviewTemplate, 'text/html').body.firstChild
            const previewFileName = attachmentPreview.querySelector('.file-name-preview')
            previewFileName.setAttribute('title', originalFileName)
            previewFileName.textContent = originalFileName
            attachmentPreview.querySelector('.file-type-preview').textContent = originalFileName.split('.').pop()
            attachmentPreview.setAttribute('data-id', id)
        }

        // replace progress by preview
        attachmentFiles.replaceChild(attachmentPreview, uploads[fileName].elem)
        uploads[fileName] = attachmentPreview
        resizeChatLayout()

        // set remove file event
        attachmentPreview.querySelector('.close-preview').addEventListener('click', event => {
            console.log('close preview', originalFileName)
            attachmentPreview.style.opacity = .75
            socket.emit('deleteAttachment', {id})
        })
    })

    socket.on('deletedAttachment', ({id, name}) => {
        if(uploads.hasOwnProperty(name)) {
            attachmentFiles.removeChild(uploads[name])
            delete uploads[name]
            resizeChatLayout()
        }
    })

    let selected_channel_uuid = null
    msgSend.addEventListener('click', (event) => {
        event.preventDefault()
        console.log('socket client emit on ', selected_channel_uuid, msgInput.innerHTML, uploads)

        let uploadsOver = true, file_ids = []
        for (const [, elem] of Object.entries(uploads)) {
            if (elem.hasOwnProperty('temp')) {
                uploadsOver = false
                break
            }
            else {
                file_ids.push(elem.dataset.id)
            }
        }

        if(selected_channel_uuid && (msgInput.innerHTML.trim() != '' || uploadsOver)) {
            socket.emit('handleMessage', {
                channel_uuid: selected_channel_uuid,
                value: msgInput.innerHTML,
                file_ids: file_ids.length == 0 ? null : file_ids.join(',')
            })
            msgInput.innerHTML = ''
            attachmentFiles.innerHTML = ''
            for (var name in uploads) delete uploads[name]
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
            // console.log(elem)
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

    initMessageInput()
})()
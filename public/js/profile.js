(function () {
    const canvas = document.getElementById('img-cropper')

    const editNameBtn = document.getElementById('edit-name-btn')
    const saveNameBtn = document.getElementById('save-name-btn')
    const infoName = document.querySelector('.info-name')
    const infoNameText = infoName.querySelector('.info-name-text')
    const inputName = document.querySelector('.input-name')
    const inputFirstName = inputName.querySelector('#input-first-name')
    const inputLastName = inputName.querySelector('#input-last-name')
    
    const profileImg = document.querySelector('.profile-img')
    const inputProfileImg = document.getElementById('input-profile-img')
    const modalProfileImg = document.getElementById('modal-profile-img')
    const profileImgBtn = document.getElementById('profile-img-btn')
    const rawProfileImg = document.getElementById('raw-profile-img')
    let modalInstanceProfileImg, croppr, cropprImageSet = false

    function getCroppedImage(type) {
        const data = croppr.getValue(), ctx = canvas.getContext('2d')

        canvas.setAttribute('width', 500)
        canvas.setAttribute('height', 500)

        ctx.drawImage(rawProfileImg, data.x, data.y, data.width, data.height, 0, 0, 500, 500)

        return canvas.toDataURL(type)
    }

    editNameBtn.addEventListener('click', event => {
        infoName.classList.add('hide')
        inputName.classList.remove('hide')
        editNameBtn.classList.add('hide')
        saveNameBtn.classList.remove('hide')
    })
    saveNameBtn.addEventListener('click', event => {
        let firstName = inputFirstName.value, lastName = inputLastName.value
        fetch('/profileName', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ firstName, lastName })
        })
        .then(res => res.json())
        .then(data => {
            console.log(data)
            if(data.success) {
                infoNameText.innerText = data.firstName + ' ' + data.lastName
                inputFirstName.value = data.firstName
                inputLastName.value = data.lastName

                infoName.classList.remove('hide')
                inputName.classList.add('hide')
                editNameBtn.classList.remove('hide')
                saveNameBtn.classList.add('hide')
                // toast
            }
            if(data.error) {

            }
        })
        .catch(err => {
            console.log(err)
        })
    })
    
    document.addEventListener('DOMContentLoaded', () => {
        const options = {}
        const elems = document.querySelectorAll('.modal')
        const instances = M.Modal.init(elems, options)

        modalInstanceProfileImg = M.Modal.getInstance(modalProfileImg)
    })

    profileImg.addEventListener('click', event => {
        inputProfileImg.click()
    })
    inputProfileImg.addEventListener('change', event => {
        console.log(inputProfileImg.files)
        if (inputProfileImg.files && inputProfileImg.files[0]) {
            console.log('true')
            const reader = new FileReader();
            reader.onload = function (e) {
                console.log(e.target.result)
                if(cropprImageSet) {
                    croppr.setImage(e.target.result)
                }
                else {
                    rawProfileImg.src = e.target.result
                    croppr = new Croppr('#raw-profile-img', {
                        aspectRatio: 1,
                    })
                    cropprImageSet = true
                }

                modalInstanceProfileImg.open()
            }
            reader.readAsDataURL(inputProfileImg.files[0])
        }
    })
    profileImgBtn.addEventListener('click', event => {
        console.log('data', croppr.getValue())
        console.log(getCroppedImage())
        fetch('/profileImage', {
            method: 'post',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: getCroppedImage(inputProfileImg.files[0].type), // 'image/jpeg'
                name: inputProfileImg.files[0].name,
                type: inputProfileImg.files[0].type
            })
        })
        .then(res => res.json())
        .then(data => {
            console.log(data)
            if(data.success) {
                profileImg.src = data.imageUrl
            }
            modalInstanceProfileImg.close()
        })
        .catch(err => {
            console.log(err)
        })
    })
})()
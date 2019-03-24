import $ from 'blingblingjs'
import { getStyle } from '../utilities/'

let imgs      = []
  , overlays  = []
  , dragItem

export function watchImagesForUpload() {
  imgs = $([
    ...document.images,
    ...findBackgroundImages(document),
  ])

  clearWatchers(imgs)
  initWatchers(imgs)
}

const initWatchers = imgs => {
  imgs.on('dragover', onDragEnter)
  imgs.on('dragleave', onDragLeave)
  imgs.on('drop', onDrop)
  $(document.body).on('dragover', onDragEnter)
  $(document.body).on('dragleave', onDragLeave)
  $(document.body).on('drop', onDrop)
  $(document.body).on('dragstart', onDragStart)
  $(document.body).on('dragend', onDragEnd)
}

const clearWatchers = imgs => {
  imgs.off('dragenter', onDragEnter)
  imgs.off('dragleave', onDragLeave)
  imgs.off('drop', onDrop)
  $(document.body).off('dragenter', onDragEnter)
  $(document.body).off('dragleave', onDragLeave)
  $(document.body).off('drop', onDrop)
  $(document.body).on('dragstart', onDragStart)
  $(document.body).on('dragend', onDragEnd)
  imgs = []
}

const previewFile = file => {
  return new Promise((resolve, reject) => {
    let reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onloadend = () => resolve(reader.result)
  })
}

// only fired for in-page drag events, track what the user picked up
const onDragStart = ({target}) =>
  dragItem = target

const onDragEnd = e =>
  dragItem = undefined

const onDragEnter =async e => {
  e.preventDefault()
  e.stopPropagation()

  const pre_selected = $('img[data-selected=true]')
  if(imgs.some(img => img === e.target)){
    if(!pre_selected.length){
      if(! e.dataTransfer.types.some(type => type === 'Files')){
        previewDrop(e.target);
      }
      showOverlay(e.currentTarget, 0)
    }else{
      if(pre_selected.some(node => node == e.target) && ! e.dataTransfer.types.some(type => type === 'Files')){
        pre_selected.forEach(node => previewDrop(node))
      }
      pre_selected.forEach((img, i) =>
        showOverlay(img, i))
    }
  }
}

const onDragLeave = e => {
  e.stopPropagation()
  const pre_selected = $('img[data-selected=true]')
  if(! pre_selected.some(node => node === e.target))
    resetPreviewed(e.target)
  else
    pre_selected.forEach(node => resetPreviewed(node))

  hideOverlays()
}


const onDrop = async e => {
  e.stopPropagation()
  e.preventDefault()

  const selectedImages = $('img[data-selected=true]')

  const srcs = e.dataTransfer.files.length
    ? await Promise.all([...e.dataTransfer.files]
      .filter(file => file.type.includes('image'))
      .map(previewFile))
    : [dragItem.currentSrc]

  if (srcs.length) {
    const targetImages = selectedImages.length && selectedImages.some(img => img == e.target) ? selectedImages
      : e.target.nodeName === 'IMG' && !selectedImages.length ? [e.target]
      : [];

    if (targetImages.length){
      let i = 0
      targetImages.forEach(img => {
        clearDragHistory(img)
        img.src = srcs[i]
        if(img.srcset !== '')
          img.srcset = srcs[i]
        const sources = Array.from(img.parentElement.children)
          .filter(sibling => sibling.nodeName === 'SOURCE')
        if(sources){
          sources.forEach(source => {
            if(!source.media || window.matchMedia(source.media).matches){
              source.srcset = srcs[i]
            }
          })
        }
        i = ++i % srcs.length
      })
    }else{
      imgs
        .filter(img => img.contains(e.target))
        .forEach(img => {
          clearDragHistory(img)
          if(window.getComputedStyle(img).backgroundImage != 'none')
            img.style.backgroundImage = `url(${srcs[0]})`
        })
    }
  }

  hideOverlays()
}

const showOverlay = (node, i) => {
  const rect    = node.getBoundingClientRect()
  const overlay = overlays[i]

  if (overlay) {
    overlay.update = rect
  }
  else {
    overlays[i] = document.createElement('visbug-overlay')
    overlays[i].position = rect
    document.body.appendChild(overlays[i])
  }
}

const hideOverlays = () => {
  overlays.forEach(overlay =>
    overlay.remove())
  overlays = []
}

const findBackgroundImages = el => {
  const src_regex = /url\(\s*?['"]?\s*?(\S+?)\s*?["']?\s*?\)/i

  return $('*').reduce((collection, node) => {
    const prop = getStyle(node, 'background-image')
    const match = src_regex.exec(prop)

    // if (match) collection.push(match[1])
    if (match) collection.push(node)

    return collection
  }, [])
}

const previewDrop = async (node) => {
  if(! ['lastSrc','lastSrcset','lastSiblings','lastBackgroundImage'].some(prop => node[prop])){
    const setSrc = dragItem.currentSrc
    if(window.getComputedStyle(node).backgroundImage !== 'none'){
      node.lastBackgroundImage = window.getComputedStyle(node).backgroundImage
      node.style.backgroundImage = `url(${setSrc})`
    }else{
      node.lastSrc = node.src
      node.lastSrcset = node.srcset
      const sibSource = Array.from(node.parentElement.children).filter(node => node.tagName === 'SOURCE')
      if(sibSource.length){
        node.lastSiblings = sibSource
        sibSource.forEach(sib => sib.parentElement.removeChild(sib))
      }
      node.srcset = ''
      node.src = setSrc
    }
  }
}

const resetPreviewed = (node) => {
  if(node.lastSrc)
    node.src = node.lastSrc

  if(node.lastSrcset)
    node.srcset = node.lastSrcset

  if(node.lastSiblings)
    node.lastSiblings.forEach(sib => node.parentElement.insertBefore(sib, node))

  if(node.lastBackgroundImage)
    node.style.backgroundImage = node.lastBackgroundImage

  clearDragHistory(node)
}

const clearDragHistory = (node) => {
  ['lastSrc','lastSrcset','lastSiblings','lastBackgroundImage'].forEach(prop => node[prop] = null)
}

Object.assign(Element.prototype, {
  transform(obj, useAnimation) {
    if (useAnimation) {
      this.style.transition = 'transform .3s'
    } else {
      this.style.transition = 'initial'
    }
    this.style.transform = [
      `translate3d(${obj.translate.x}px, ${obj.translate.y}px, 0)`,
      `scale3d(${obj.scale}, ${obj.scale}, ${obj.scale})`
    ].join(' ')
  }
})

function pinchZoom(el) {
  let transform = {
    scale: 1,
    translate: {
      x: 0, y: 0
    }
  }
  if (el.pinched) {
    el.transform(transform, false)
    el.style.transformOrigin = '0 0'
    return
  }

  let initTransform = Object.assign({}, transform)
  el.pinched = true

  const mc = new Hammer.Manager(el)
  mc.add(new Hammer.Pan())
  mc.add(new Hammer.Pinch()).recognizeWith(mc.get('pan'))
  mc.add(new Hammer.Tap({
    event: 'doubletap', taps: 2
  }))

  mc.on('doubletap', e => {
    if (transform.scale > 1) {
      transform.scale = 1
    } else {
      transform.scale = 3
    }
    let originX = e.center.x - e.target.offsetLeft
    let originY = e.center.y - e.target.offsetTop
    e.target.style.transformOrigin = `${originX}px ${originY}px`
    e.target.transform(transform, true)
  })

  mc.on('panstart panmove', e => {
    if (e.type == 'panstart') {
      initTransform.translate = transform.translate
    }
    transform.translate = {
      x: initTransform.translate.x + e.deltaX,
      y: initTransform.translate.y + e.deltaY
    }
    e.target.transform(transform, false)
  })

  mc.on('pinchstart pinchmove', e => {
    if (e.type == 'pinchstart') {
      initTransform.scale = transform.scale
    }
    transform.scale = initTransform.scale * e.scale
    e.target.transform(transform, false)
  })
}

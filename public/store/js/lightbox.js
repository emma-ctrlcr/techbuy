/* ══════════════════════════════════════════════════════════════
   ZOOM MODAL — Fullscreen gallery tipo Mercado Libre/eBay
   Sin dependencias externas
══════════════════════════════════════════════════════════════ */

let TB_LIGHTBOX = null;

/* ── Zoom state ──────────────────────────────────────────── */
var _z = {
  scale: 1,
  translateX: 0,
  translateY: 0,
  images: [],
  currentIndex: 0,
  isOpen: false,
  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  panStartTX: 0,
  panStartTY: 0,
  imgW: 0,
  imgH: 0,
  fittedW: 0,
  fittedH: 0,
  containerW: 0,
  containerH: 0,
  pinchDist: 0,
  pinchScale: 1,
  swipeStartX: 0,
  swipeStartY: 0,
  swipeTime: 0,
};

/* ── DOM references (set once) ──────────────────────────── */
var _modal, _wrapper, _img, _loader, _counter, _prevBtn, _nextBtn, _closeBtn, _thumbsStrip;
var _keyHandler, _resizeHandler;

/* ── Init modal from existing DOM (HTML en producto.html) ── */
function _buildModal() {
  if (_modal) return;

  _modal = document.getElementById('tbZoomModal');
  if (!_modal) { console.error('tbZoomModal no encontrado'); return; }

  _wrapper      = _modal.querySelector('.tb-zoom-wrapper');
  _img          = document.getElementById('tbZoomImg');
  _loader       = _modal.querySelector('.tb-zoom-loader');
  _counter      = document.getElementById('tbZoomCounter');
  _prevBtn      = document.getElementById('tbZoomPrev');
  _nextBtn      = document.getElementById('tbZoomNext');
  _closeBtn     = document.getElementById('tbZoomClose');
  _thumbsStrip  = document.getElementById('tbZoomThumbs');

  if (!_closeBtn || !_img || !_counter) { console.error('tbZoomModal child missing'); return; }

  _closeBtn.addEventListener('click', closeZoom);

  _modal.addEventListener('click', function (e) {
    if (e.target === _modal || e.target === _wrapper) closeZoom();
  });

  _img.addEventListener('load',   _onImgLoad);
  _img.addEventListener('error',  _onImgError);
  _img.addEventListener('wheel',  _onWheel, { passive: false });
  _img.addEventListener('dblclick', _onDblClick);
  _img.addEventListener('mousedown', _onPanStart);

  _img.addEventListener('touchstart', _onTouchStart, { passive: true });
  _img.addEventListener('touchmove',  _onTouchMove,  { passive: false });
  _img.addEventListener('touchend',   _onTouchEnd);
  _img.addEventListener('touchcancel',_onTouchEnd);

  _keyHandler = function (e) {
    if (!_z.isOpen) return;
    switch (e.key) {
      case 'Escape':    closeZoom(); e.preventDefault(); break;
      case 'ArrowLeft': _nav(-1);   e.preventDefault(); break;
      case 'ArrowRight':_nav(1);    e.preventDefault(); break;
    }
  };
  document.addEventListener('keydown', _keyHandler);

  _resizeHandler = function () { if (_z.isOpen) _fitImg(); };
  window.addEventListener('resize', _resizeHandler);

  document.addEventListener('mouseup',  _onPanEnd);
  document.addEventListener('mousemove', _onPanMove);
}

/* ══════════════════════════════════════════════════════════
   AUTO-INIT on DOM ready
══════════════════════════════════════════════════════════ */

(function () {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _buildModal);
  } else {
    _buildModal();
  }
})();

/* ══════════════════════════════════════════════════════════
   PUBLIC API
══════════════════════════════════════════════════════════ */

function TB_initLightbox() { /* called from producto.js, already done */ }
function TB_refreshLightbox() { /* no-op */ }

function TB_openZoom(images, index) {
  _buildModal();
  if (!images || !images.length) return;

  _z.scale = 1;
  _z.translateX = 0;
  _z.translateY = 0;
  _z.images = images;
  _z.currentIndex = typeof index === 'number' ? index : 0;

  _renderThumbs();
  _showImage();
  _modal.classList.add('open');
  _z.isOpen = true;
  document.body.style.overflow = 'hidden';
}

function TB_setZoomIndex(index) {
  if (!_z.isOpen || index < 0 || index >= _z.images.length) return;
  if (index === _z.currentIndex) return;
  _z.currentIndex = index;
  _z.scale = 1;
  _z.translateX = 0;
  _z.translateY = 0;
  _showImage();
  _syncThumbActive();
}

function closeZoom() {
  if (!_z.isOpen) return;
  _z.isOpen = false;
  _modal.classList.remove('open');
  document.body.style.overflow = '';
  _z.scale = 1;
  _z.translateX = 0;
  _z.translateY = 0;
}

/* ══════════════════════════════════════════════════════════
   THUMBNAIL STRIP
══════════════════════════════════════════════════════════ */

function _renderThumbs() {
  if (!_thumbsStrip) return;
  var html = '';
  for (var i = 0; i < _z.images.length; i++) {
    html += '<div class="tb-zoom-thumb' + (i === _z.currentIndex ? ' active' : '') + '" data-idx="' + i + '">' +
      '<img src="' + _z.images[i] + '" alt="" loading="lazy">' +
    '</div>';
  }
  _thumbsStrip.innerHTML = html;
  _thumbsStrip.style.display = _z.images.length > 1 ? 'flex' : 'none';

  _thumbsStrip.querySelectorAll('.tb-zoom-thumb').forEach(function (el) {
    el.addEventListener('click', function () {
      var idx = parseInt(this.dataset.idx);
      TB_setZoomIndex(idx);
      _syncPageImage(idx);
      _syncPageThumb(idx);
    });
  });
}

function _syncThumbActive() {
  if (!_thumbsStrip) return;
  _thumbsStrip.querySelectorAll('.tb-zoom-thumb').forEach(function (el) {
    el.classList.toggle('active', parseInt(el.dataset.idx) === _z.currentIndex);
  });
  /* Scroll into view */
  var active = _thumbsStrip.querySelector('.tb-zoom-thumb.active');
  if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

/* ══════════════════════════════════════════════════════════
   INTERNAL
══════════════════════════════════════════════════════════ */

function _showImage() {
  var idx = _z.currentIndex;
  var url = _z.images[idx];

  _img.classList.remove('loaded');
  _loader.classList.add('active');

  _img.src = url;

  _counter.textContent = (idx + 1) + ' / ' + _z.images.length;
  _prevBtn.classList.toggle('hidden', idx === 0);
  _nextBtn.classList.toggle('hidden', idx === _z.images.length - 1);
}

function _onImgLoad() {
  _loader.classList.remove('active');
  _fitImg();
  _img.classList.add('loaded');
}

function _onImgError() {
  _loader.classList.remove('active');
  _img.classList.add('loaded');
}

function _fitImg() {
  if (!_img.complete || !_img.naturalWidth) return;

  _z.imgW = _img.naturalWidth;
  _z.imgH = _img.naturalHeight;
  _z.containerW = _wrapper.clientWidth;
  _z.containerH = _wrapper.clientHeight;

  var scaleX = _z.containerW / _z.imgW;
  var scaleY = _z.containerH / _z.imgH;
  var fit = Math.min(scaleX, scaleY, 1);

  _z.fittedW = _z.imgW * fit;
  _z.fittedH = _z.imgH * fit;

  var offX = (_z.containerW - _z.fittedW) / 2;
  var offY = (_z.containerH - _z.fittedH) / 2;

  _img.style.width = _z.fittedW + 'px';
  _img.style.height = _z.fittedH + 'px';

  _z.translateX = offX;
  _z.translateY = offY;
  _z.scale = 1;

  _applyTransform(offX, offY, 1);
}

function _applyTransform(tx, ty, sc) {
  _img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + sc + ')';
}

function _nav(dir) {
  if (!_z.images || !_z.images.length) return;
  var newIdx = _z.currentIndex + dir;
  if (newIdx < 0 || newIdx >= _z.images.length) return;
  _z.currentIndex = newIdx;
  _z.scale = 1;
  _z.translateX = 0;
  _z.translateY = 0;

  _syncPageImage(newIdx);
  _syncPageThumb(newIdx);
  _showImage();
  _syncThumbActive();
}

function _syncPageImage(idx) {
  var mainImgTag = document.getElementById('pdpMainImgTag');
  if (mainImgTag) mainImgTag.src = _z.images[idx];
}

function _syncPageThumb(idx) {
  var thumbs = document.querySelectorAll('.pdp-thumb');
  thumbs.forEach(function (t) { t.classList.remove('active'); });
  var activeThumb = document.querySelector('.pdp-thumb[data-idx="' + idx + '"]');
  if (activeThumb) activeThumb.classList.add('active');
}

/* ── WHEEL ZOOM ─────────────────────────────────────────── */
function _onWheel(e) {
  e.preventDefault();

  var delta = -Math.sign(e.deltaY) * 0.08;
  var newScale = Math.max(0.5, Math.min(10, _z.scale + delta * _z.scale));
  if (newScale === _z.scale) return;

  var rect = _wrapper.getBoundingClientRect();
  var cx = (e.clientX - rect.left) / _z.containerW;
  var cy = (e.clientY - rect.top) / _z.containerH;

  var imgCX = (cx * _z.containerW - _z.translateX) / (_z.fittedW * _z.scale);
  var imgCY = (cy * _z.containerH - _z.translateY) / (_z.fittedH * _z.scale);

  var newTX = cx * _z.containerW - imgCX * _z.fittedW * newScale;
  var newTY = cy * _z.containerH - imgCY * _z.fittedH * newScale;

  _z.scale = newScale;
  _z.translateX = _clampPan(newTX, newScale, true);
  _z.translateY = _clampPan(newTY, newScale, false);

  _applyTransform(_z.translateX, _z.translateY, _z.scale);
}

/* ── DOUBLE-CLICK ZOOM ──────────────────────────────────── */
function _onDblClick(e) {
  e.preventDefault();

  if (_z.scale > 1.1) {
    var offX = (_z.containerW - _z.fittedW) / 2;
    var offY = (_z.containerH - _z.fittedH) / 2;
    _z.scale = 1;
    _z.translateX = offX;
    _z.translateY = offY;
    _applyTransform(offX, offY, 1);
    return;
  }

  var targetScale = 2.5;
  var rect = _wrapper.getBoundingClientRect();
  var cx = (e.clientX - rect.left) / _z.containerW;
  var cy = (e.clientY - rect.top) / _z.containerH;

  var imgCX = (cx * _z.containerW - _z.translateX) / (_z.fittedW * _z.scale);
  var imgCY = (cy * _z.containerH - _z.translateY) / (_z.fittedH * _z.scale);

  var newTX = cx * _z.containerW - imgCX * _z.fittedW * targetScale;
  var newTY = cy * _z.containerH - imgCY * _z.fittedH * targetScale;

  _z.scale = targetScale;
  _z.translateX = _clampPan(newTX, targetScale, true);
  _z.translateY = _clampPan(newTY, targetScale, false);

  _applyTransform(_z.translateX, _z.translateY, _z.scale);
}

/* ── PAN (MOUSE) ────────────────────────────────────────── */
function _onPanStart(e) {
  if (_z.scale <= 1) return;
  _z.isPanning = true;
  _z.panStartX = e.clientX;
  _z.panStartY = e.clientY;
  _z.panStartTX = _z.translateX;
  _z.panStartTY = _z.translateY;
  _img.classList.add('grabbing');
}

function _onPanMove(e) {
  if (!_z.isPanning) return;
  var dx = e.clientX - _z.panStartX;
  var dy = e.clientY - _z.panStartY;
  _z.translateX = _clampPan(_z.panStartTX + dx, _z.scale, true);
  _z.translateY = _clampPan(_z.panStartTY + dy, _z.scale, false);
  _applyTransform(_z.translateX, _z.translateY, _z.scale);
}

function _onPanEnd() {
  if (!_z.isPanning) return;
  _z.isPanning = false;
  _img.classList.remove('grabbing');
}

/* ── TOUCH: SWIPE + PINCH + PAN ──────────────────────────── */
var _touchCache = {};

function _onTouchStart(e) {
  if (e.touches.length === 2) {
    var t = e.touches;
    _touchCache.pinchDist = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    _touchCache.pinchScale = _z.scale;
    _touchCache.pinchTX = _z.translateX;
    _touchCache.pinchTY = _z.translateY;
    _touchCache.isPinching = true;
    return;
  }

  if (e.touches.length === 1) {
    _z.swipeStartX = e.touches[0].clientX;
    _z.swipeStartY = e.touches[0].clientY;
    _z.swipeTime = Date.now();

    if (_z.scale > 1) {
      _z.isPanning = true;
      _z.panStartX = e.touches[0].clientX;
      _z.panStartY = e.touches[0].clientY;
      _z.panStartTX = _z.translateX;
      _z.panStartTY = _z.translateY;
    }
  }
}

function _onTouchMove(e) {
  if (_touchCache.isPinching && e.touches.length === 2) {
    e.preventDefault();
    var t = e.touches;
    var dist = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    var ratio = dist / _touchCache.pinchDist;
    var newScale = Math.max(0.5, Math.min(10, _touchCache.pinchScale * ratio));

    var cx = (t[0].clientX + t[1].clientX) / 2;
    var cy = (t[0].clientY + t[1].clientY) / 2;
    var wRect = _wrapper.getBoundingClientRect();
    var rcx = (cx - wRect.left) / _z.containerW;
    var rcy = (cy - wRect.top) / _z.containerH;

    var imgCX = (rcx * _z.containerW - _touchCache.pinchTX) / (_z.fittedW * _touchCache.pinchScale);
    var imgCY = (rcy * _z.containerH - _touchCache.pinchTY) / (_z.fittedH * _touchCache.pinchScale);

    var newTX = rcx * _z.containerW - imgCX * _z.fittedW * newScale;
    var newTY = rcy * _z.containerH - imgCY * _z.fittedH * newScale;

    _z.scale = newScale;
    _z.translateX = _clampPan(newTX, newScale, true);
    _z.translateY = _clampPan(newTY, newScale, false);

    _applyTransform(_z.translateX, _z.translateY, _z.scale);
    return;
  }

  if (_z.isPanning && e.touches.length === 1) {
    e.preventDefault();
    var dx = e.touches[0].clientX - _z.panStartX;
    var dy = e.touches[0].clientY - _z.panStartY;
    _z.translateX = _clampPan(_z.panStartTX + dx, _z.scale, true);
    _z.translateY = _clampPan(_z.panStartTY + dy, _z.scale, false);
    _applyTransform(_z.translateX, _z.translateY, _z.scale);
  }
}

function _onTouchEnd(e) {
  if (_touchCache.isPinching) {
    _touchCache.isPinching = false;
    _z.isPanning = false;
    return;
  }

  /* Swipe detection: only when not zoomed */
  if (!_z.isPanning && _z.scale <= 1 && e.changedTouches && e.changedTouches.length === 1) {
    var touch = e.changedTouches[0];
    var dx = touch.clientX - _z.swipeStartX;
    var dy = touch.clientY - _z.swipeStartY;
    var dt = Date.now() - _z.swipeTime;
    var absDx = Math.abs(dx);
    var absDy = Math.abs(dy);

    if (absDx > 40 && absDx > absDy * 2 && dt < 400) {
      if (dx > 0) { _nav(-1); } else { _nav(1); }
    }
  }

  _z.isPanning = false;
  _touchCache.isPinching = false;
  _img.classList.remove('grabbing');
}

/* ── PAN CLAMP ───────────────────────────────────────────── */
function _clampPan(value, scale, isX) {
  var imgSize = isX ? _z.fittedW : _z.fittedH;
  var containerSize = isX ? _z.containerW : _z.containerH;
  var scaledSize = imgSize * scale;
  var excess = scaledSize - containerSize;

  if (excess <= 0) {
    return (containerSize - scaledSize) / 2;
  }

  var margin = excess * 0.15;
  var minVal = -(excess + margin);
  var maxVal = margin;
  return Math.max(minVal, Math.min(maxVal, value));
}

/* ══════════════════════════════════════════════════════════
   LIGHTBOX CARD HELPER (for recommendation cards)
══════════════════════════════════════════════════════════ */

function TB_lightboxCardHTML(p) {
  if (!p.imagenes || !p.imagenes.length) return '';
  return '<img src="' + p.imagenes[0] + '" alt="' + p.name + '" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">';
}

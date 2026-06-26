/**
 * GSW Inventory — Store Integration
 * Fetches live product data from the Flask inventory API
 * and renders it into the existing Porto HTML/CSS classes.
 */
(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────
  var API_BASE = (window.GSW_CONFIG && window.GSW_CONFIG.API_BASE) || '';
  var PLACEHOLDER_IMG = 'img/products/product-grey-1.jpg';

  // ── Helpers ─────────────────────────────────────────────────────
  function apiUrl(path) {
    return API_BASE + path;
  }

  function fetchJSON(url) {
    return fetch(url, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      });
  }

  function formatPrice(val) {
    var n = parseFloat(val);
    return isNaN(n) ? '$0.00' : '$' + n.toFixed(2);
  }

  function stockBadgeHtml(item) {
    if (item.stock_status === 'out_of_stock' || item.amount === 0) {
      return '<span class="badge badge-ecommerce text-bg-danger">OUT OF STOCK</span>';
    }
    if (item.stock_status === 'low_stock' || item.amount < 10) {
      return '<span class="badge badge-ecommerce" style="background:#f59e0b;">LOW STOCK</span>';
    }
    return '';
  }

  function availabilityText(item) {
    if (item.stock_status === 'out_of_stock' || item.amount === 0) {
      return '<strong class="text-danger">OUT OF STOCK</strong>';
    }
    if (item.stock_status === 'low_stock' || item.amount < 10) {
      return '<strong style="color:#f59e0b;">LOW STOCK (' + item.amount + ' left)</strong>';
    }
    return '<strong class="text-color-dark">IN STOCK</strong>';
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Product card (matches index.html Porto grid structure) ───────
  function buildProductCard(item) {
    var img = item.image_url || PLACEHOLDER_IMG;
    var detailUrl = 'product.html?id=' + encodeURIComponent(item.id);
    var categoryDisplay = escHtml(item.category_name || '');
    var badge = stockBadgeHtml(item);

    return '<div class="col-12 col-sm-6 col-lg-3">'
      + '<div class="product mb-0">'
      + '<div class="product-thumb-info border-0 mb-3">'
      + (badge ? '<div class="product-thumb-info-badges-wrapper">' + badge + '</div>' : '')
      + '<a href="' + detailUrl + '">'
      + '<div class="product-thumb-info-image">'
      + '<img alt="' + escHtml(item.name) + '" class="img-fluid" src="' + escHtml(img) + '" '
      + 'onerror="this.src=\'' + PLACEHOLDER_IMG + '\'">'
      + '</div></a>'
      + '</div>'
      + '<div class="d-flex justify-content-between">'
      + '<div>'
      + (categoryDisplay ? '<a href="index.html?cat=' + encodeURIComponent(item.category_name) + '" class="d-block text-uppercase text-decoration-none text-color-default text-color-hover-primary line-height-1 text-0 mb-1">' + categoryDisplay + '</a>' : '')
      + '<h3 class="text-3-5 font-weight-medium font-alternative text-transform-none line-height-3 mb-0">'
      + '<a href="' + detailUrl + '" class="text-color-dark text-color-hover-primary">' + escHtml(item.name) + '</a>'
      + '</h3>'
      + '</div>'
      + '</div>'
      + '<p class="price text-5 mb-3 mt-1">'
      + '<span class="sale text-color-dark font-weight-semi-bold">' + formatPrice(item.store_price) + '</span>'
      + '</p>'
      + '</div>'
      + '</div>';
  }

  // ── Index page: load and render product grid ─────────────────────
  function initIndexPage() {
    var grid = document.getElementById('gsw-products-grid');
    var filterBar = document.getElementById('gsw-category-filter');
    if (!grid) return;

    var allItems = [];
    var currentCat = getUrlParam('cat') || 'all';

    // Show loading state
    grid.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">Loading products…</p></div>';

    // Load categories for filter bar
    if (filterBar) {
      fetchJSON(apiUrl('/api/store/categories'))
        .then(function (cats) {
          var html = '<button class="btn btn-sm me-1 mb-1 gsw-cat-btn' + (currentCat === 'all' ? ' btn-dark' : ' btn-outline-dark') + '" data-cat="all">All</button>';
          cats.forEach(function (c) {
            html += '<button class="btn btn-sm me-1 mb-1 gsw-cat-btn' + (currentCat === c.name ? ' btn-dark' : ' btn-outline-dark') + '" data-cat="' + escHtml(c.name) + '" style="border-color:' + escHtml(c.color) + ';' + (currentCat === c.name ? 'background:' + escHtml(c.color) + ';border-color:' + escHtml(c.color) : 'color:' + escHtml(c.color)) + '">' + escHtml(c.name) + '</button>';
          });
          filterBar.innerHTML = html;

          // Category filter click handler
          filterBar.addEventListener('click', function (e) {
            var btn = e.target.closest('.gsw-cat-btn');
            if (!btn) return;
            currentCat = btn.dataset.cat;
            filterBar.querySelectorAll('.gsw-cat-btn').forEach(function (b) {
              b.classList.remove('btn-dark');
              b.classList.add('btn-outline-dark');
              b.style.background = '';
            });
            btn.classList.remove('btn-outline-dark');
            btn.classList.add('btn-dark');
            renderFiltered();
          });
        })
        .catch(function () {
          // Category filter is optional — silently skip if API is down
        });
    }

    // Wire search box
    var searchBox = document.getElementById('gsw-search');
    if (searchBox) {
      searchBox.addEventListener('input', renderFiltered);
    }

    function renderFiltered() {
      var q = (searchBox ? searchBox.value : '').toLowerCase().trim();
      var filtered = allItems.filter(function (item) {
        var matchCat = currentCat === 'all' || item.category_name === currentCat;
        var matchQ = !q || (item.name || '').toLowerCase().includes(q)
          || (item.brand || '').toLowerCase().includes(q)
          || (item.sku || '').toLowerCase().includes(q)
          || (item.category_name || '').toLowerCase().includes(q);
        return matchCat && matchQ;
      });

      if (!filtered.length) {
        grid.innerHTML = '<div class="col-12 text-center py-5 text-muted">'
          + (allItems.length ? 'No products found matching your filter.' : 'No products are currently available.')
          + '</div>';
        return;
      }
      grid.innerHTML = filtered.map(buildProductCard).join('');

      // Re-init Porto star rating plugin if present
      if (typeof $ !== 'undefined' && $.fn && $.fn.starRating) {
        $(grid).find('[data-plugin-star-rating]').each(function () {
          $(this).starRating();
        });
      }
    }

    // Fetch items
    fetchJSON(apiUrl('/api/store/items'))
      .then(function (items) {
        allItems = items || [];
        renderFiltered();
        // Also populate search category select from categories
        populateSearchCategorySelect(allItems);
      })
      .catch(function (err) {
        console.error('[GSW] Failed to load products:', err);
        grid.innerHTML = '<div class="col-12 text-center py-5">'
          + '<p class="text-muted">Unable to load products. Please try again later.</p>'
          + '</div>';
      });
  }

  // Populate the header search category dropdown with live categories
  function populateSearchCategorySelect(items) {
    var sel = document.querySelector('select[name="category"]');
    if (!sel) return;
    // Collect unique categories from items
    var cats = {};
    items.forEach(function (i) { if (i.category_name) cats[i.category_name] = true; });
    var catNames = Object.keys(cats).sort();
    if (!catNames.length) return;
    // Replace static options with live ones
    sel.innerHTML = '<option value="all" selected>All Categories</option>'
      + catNames.map(function (c) {
          return '<option value="' + escHtml(c) + '">' + escHtml(c) + '</option>';
        }).join('');
  }

  // ── Product detail page ──────────────────────────────────────────
  function initProductPage() {
    var container = document.getElementById('gsw-product-detail');
    if (!container) return;

    var itemId = getUrlParam('id');
    if (!itemId) {
      container.innerHTML = errorBlock('No product ID specified. <a href="index.html">Back to shop</a>');
      return;
    }

    container.innerHTML = '<div class="text-center py-5"><p class="text-muted">Loading product…</p></div>';

    fetchJSON(apiUrl('/api/store/items/' + encodeURIComponent(itemId)))
      .then(function (item) {
        renderProductDetail(item, container);
      })
      .catch(function (err) {
        console.error('[GSW] Failed to load product:', err);
        container.innerHTML = errorBlock('Product not found or unavailable. <a href="index.html">Back to shop</a>');
      });
  }

  function renderProductDetail(item, container) {
    var img = item.image_url || PLACEHOLDER_IMG;
    var price = formatPrice(item.store_price);

    // Build additional info rows
    var infoRows = '';
    if (item.brand) infoRows += '<tr><th class="border-top-0">Brand</th><td class="border-top-0">' + escHtml(item.brand) + '</td></tr>';
    if (item.model_number) infoRows += '<tr><th>Model</th><td>' + escHtml(item.model_number) + '</td></tr>';
    if (item.category_name) infoRows += '<tr><th>Category</th><td>' + escHtml(item.category_name) + '</td></tr>';
    if (item.voltage && item.voltage !== 'N/A') infoRows += '<tr><th>Voltage</th><td>' + escHtml(item.voltage) + '</td></tr>';

    // Update page title
    document.title = escHtml(item.name) + ' | Golden Stone Tools';

    // Update breadcrumb if present
    var breadcrumbName = document.getElementById('gsw-breadcrumb-name');
    if (breadcrumbName) breadcrumbName.textContent = item.name;

    container.innerHTML = ''
      // Image column
      + '<div class="col-lg-5 mb-4 mb-lg-0">'
      + '<div class="product-image-wrapper">'
      + '<img id="gsw-main-img" src="' + escHtml(img) + '" class="img-fluid rounded" alt="' + escHtml(item.name) + '" onerror="this.src=\'' + PLACEHOLDER_IMG + '\'">'
      + '</div>'
      + '</div>'

      // Detail column
      + '<div class="col-lg-7">'
      + '<div class="summary entry-summary">'

      + '<h1 class="mb-0 font-weight-bold text-7">' + escHtml(item.name) + '</h1>'

      + '<div class="divider divider-small"><hr class="bg-color-grey-400"></div>'

      + '<p class="price mb-3">'
      + '<span class="sale text-color-dark text-7 font-weight-bold">' + price + '</span>'
      + '</p>'

      + (item.description
          ? '<p class="text-3-5 mb-3">' + escHtml(item.description) + '</p>'
          : '')

      + '<ul class="list list-unstyled text-2 mb-3">'
      + '<li class="mb-1">AVAILABILITY: ' + availabilityText(item) + '</li>'
      + (item.sku ? '<li class="mb-1">SKU: <strong class="text-color-dark">' + escHtml(item.sku) + '</strong></li>' : '')
      + (item.brand ? '<li class="mb-1">BRAND: <strong class="text-color-dark">' + escHtml(item.brand) + '</strong></li>' : '')
      + (item.model_number ? '<li class="mb-1">MODEL: <strong class="text-color-dark">' + escHtml(item.model_number) + '</strong></li>' : '')
      + (item.category_name ? '<li class="mb-1">CATEGORY: <strong class="text-color-dark">' + escHtml(item.category_name) + '</strong></li>' : '')
      + '</ul>'

      + '<hr>'

      // Request Quote / Contact Us — no checkout
      + '<div class="d-flex gap-2 flex-wrap mb-4">'
      + '<a href="mailto:mail@example.com?subject=Quote Request: ' + encodeURIComponent(item.name) + ' (' + encodeURIComponent(item.id) + ')&body=Hi, I would like to request a quote for: ' + encodeURIComponent(item.name) + ' (SKU: ' + encodeURIComponent(item.sku || item.id) + ')." class="btn btn-dark btn-modern text-uppercase">Request a Quote</a>'
      + '<a href="about-us.html#contact" class="btn btn-outline btn-modern text-uppercase">Contact Us</a>'
      + '</div>'

      + '<hr>'

      // Social share
      + '<div class="d-flex align-items-center">'
      + '<ul class="social-icons social-icons-medium social-icons-clean-with-border social-icons-clean-with-border-border-grey social-icons-clean-with-border-icon-dark me-3 mb-0">'
      + '<li class="social-icons-facebook"><a href="http://www.facebook.com/sharer.php?u=' + encodeURIComponent(window.location.href) + '" target="_blank" title="Share on Facebook"><i class="fab fa-facebook-f"></i></a></li>'
      + '<li class="social-icons-x"><a href="https://twitter.com/share?url=' + encodeURIComponent(window.location.href) + '&text=' + encodeURIComponent(item.name) + '" target="_blank" title="Share on X"><i class="fab fa-x-twitter"></i></a></li>'
      + '</ul>'
      + '</div>'

      + '</div></div>'

      // Description + Additional Info tabs
      + '<div class="col-12 mt-5">'
      + '<div id="description" class="tabs tabs-simple tabs-simple-full-width-line tabs-product tabs-dark mb-2">'
      + '<ul class="nav nav-tabs justify-content-start">'
      + '<li class="nav-item"><a class="nav-link active font-weight-bold text-3 text-uppercase py-2 px-3" href="#productDescription" data-bs-toggle="tab">Description</a></li>'
      + (infoRows ? '<li class="nav-item"><a class="nav-link font-weight-bold text-3 text-uppercase py-2 px-3" href="#productInfo" data-bs-toggle="tab">Additional Information</a></li>' : '')
      + '</ul>'
      + '<div class="tab-content p-0">'
      + '<div class="tab-pane px-0 py-3 active" id="productDescription">'
      + (item.description ? '<p>' + escHtml(item.description) + '</p>' : '<p class="text-muted">No description available.</p>')
      + '</div>'
      + (infoRows
          ? '<div class="tab-pane px-0 py-3" id="productInfo">'
            + '<table class="table table-striped m-0"><tbody>' + infoRows + '</tbody></table>'
            + '</div>'
          : '')
      + '</div></div>'
      + '</div>';
  }

  function errorBlock(msg) {
    return '<div class="col-12 text-center py-5"><p class="text-muted">' + msg + '</p></div>';
  }

  // ── URL helpers ──────────────────────────────────────────────────
  function getUrlParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  // ── Sidebar category list (product.html) ─────────────────────────
  function initSidebarCategories() {
    var sidebar = document.getElementById('gsw-sidebar-categories');
    if (!sidebar) return;
    fetchJSON(apiUrl('/api/store/categories'))
      .then(function (cats) {
        sidebar.innerHTML = cats.map(function (c) {
          return '<li class="nav-item"><a class="nav-link" href="index.html?cat=' + encodeURIComponent(c.name) + '">' + escHtml(c.name) + '</a></li>';
        }).join('');
      })
      .catch(function () {
        sidebar.innerHTML = '<li class="nav-item text-muted text-2 p-2">Could not load categories</li>';
      });
  }

  // ── Boot ─────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    initIndexPage();
    initProductPage();
    initSidebarCategories();
  });

})();

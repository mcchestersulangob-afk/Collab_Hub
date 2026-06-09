// ============================================================
// FILTERS / TABS / SEARCH
// ============================================================

function setTab(tab) {
  currentTab = tab;
  ['all', 'unanswered', 'verified'].forEach(t => {
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });
  renderFeed();
}

function filterFeed(filter) {
  currentFilter = filter;
  activeTag = null;
  currentTab = 'all';

  setTab('all');

  ['nav-home', 'nav-unanswered', 'nav-myq', 'nav-saved', 'nav-verified'].forEach(id => {
    document.getElementById(id).classList.remove('active');
  });

  const map = {
    all: 'nav-home',
    unanswered: 'nav-unanswered',
    mine: 'nav-myq',
    saved: 'nav-saved',
    verified: 'nav-verified'
  };
  if (map[filter]) document.getElementById(map[filter]).classList.add('active');

  const titles = {
    all: 'Recent questions',
    unanswered: 'Unanswered questions',
    mine: 'My questions',
    saved: 'Saved questions',
    verified: 'Teacher verified'
  };
  document.getElementById('feed-title').textContent = titles[filter] || 'Questions';

  renderFeed();
}

function filterByTag(e, tag) {
  e.stopPropagation();
  activeTag = activeTag === tag ? null : tag;
  currentFilter = 'all';
  renderFeed();
  renderSidebarTags();
}

function handleSearch(val) {
  searchQuery = val;
  renderFeed();
}

// expose
window.setTab = setTab;
window.filterFeed = filterFeed;
window.filterByTag = filterByTag;
window.handleSearch = handleSearch;


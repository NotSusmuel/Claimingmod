console.log("ArthasMod: Costume Applied! 💅");

// Add a marker class to body to ensure styles can scope if needed (though we used !important mostly)
document.body.classList.add('ArthasMod-enabled');

// Optional: Add a subtle entry animation trigger for elements that load later
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && node.classList && node.classList.contains('message-preview')) {
                node.style.animation = 'fadeInUp 0.3s ease backwards';
            }
        });
    });
});

function parsePercentVariable(styleText, variableName) {
    const directMatch = styleText.match(new RegExp(`${variableName}\\s*:\\s*([-\\d.]+)%`, 'i'));
    if (directMatch) return parseFloat(directMatch[1]);

    const calcMatch = styleText.match(new RegExp(`${variableName}\\s*:\\s*calc\\(([-\\d.]+)%`, 'i'));
    if (calcMatch) return parseFloat(calcMatch[1]);

    return null;
}

function parseHeaderDate(text) {
    const match = text.match(/(\d{1,2})\s*[.\-/]\s*(\d{1,2})(?:\s*[.\-/]\s*(\d{2,4}))?/);
    if (!match) return null;

    const day = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    if (!Number.isFinite(day) || !Number.isFinite(month)) return null;
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;

    const now = new Date();
    let year = now.getFullYear();
    if (match[3]) {
        year = Number.parseInt(match[3], 10);
        if (!Number.isFinite(year)) return null;
        if (match[3].length === 2) year += year >= 70 ? 1900 : 2000;
    } else {
        const currentMonth = now.getMonth() + 1;
        if (currentMonth === 1 && month === 12) year -= 1;
        if (currentMonth === 12 && month === 1) year += 1;
    }

    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getStartOfIsoWeek(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - dayOffset);
    return start;
}

function formatDateAsWeekKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getCurrentWeekKey() {
    return formatDateAsWeekKey(getStartOfIsoWeek(new Date()));
}

function getWeekKeyFromDates(dates) {
    if (!dates.length) return null;

    const minDate = dates.reduce((min, current) => (current < min ? current : min), dates[0]);
    return formatDateAsWeekKey(getStartOfIsoWeek(minDate));
}

function getDisplayedWeekStatus(headerColumns) {
    const dates = headerColumns
        .map((column) => parseHeaderDate(column.textContent || ''))
        .filter(Boolean);

    if (dates.length === 0) return 'unknown';

    const minDate = dates.reduce((min, current) => (current < min ? current : min), dates[0]);
    const maxDate = dates.reduce((max, current) => (current > max ? current : max), dates[0]);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (maxDate < today) return 'past';
    if (minDate > today) return 'future';
    return 'current';
}

function getCurrentTimePercent() {
    const currentLine = document.querySelector('.time-line-container .current-time, .current-time');
    if (!currentLine) return null;

    const styleText = (currentLine.getAttribute('style') || '').toLowerCase();
    const inlineTop = parsePercentVariable(styleText, 'top')
        ?? parsePercentVariable(styleText, '--top');
    if (inlineTop !== null && !Number.isNaN(inlineTop)) return inlineTop;

    const container = currentLine.closest('.time-line-container');
    if (!container) return null;

    const lineRect = currentLine.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    if (containerRect.height <= 0) return null;

    return ((lineRect.top - containerRect.top) / containerRect.height) * 100;
}

function applyPastLessonClasses(entries) {
    const allDayColumns = Array.from(document.querySelectorAll('.day-all-container .day-all-column, .day-all-container .calendar-week-day'))
        .filter((column) => !column.closest('#isy-cached-timetable'));
    const headerColumns = Array.from(document.querySelectorAll('.day-header-container .calendar-week-day'))
        .filter((column) => !column.closest('#isy-cached-timetable'));
    const dayColumns = Array.from(document.querySelectorAll('.day-container .calendar-week-day'))
        .filter((column) => !column.classList.contains('calendar-week-day--all-day'))
        .filter((column) => !column.closest('#isy-cached-timetable'));
    const currentTimePercent = getCurrentTimePercent();
    const weekStatus = getDisplayedWeekStatus(headerColumns);

    let todayIndex = -1;

    if (headerColumns.length > 0) {
        todayIndex = headerColumns.findIndex((column) => Boolean(
            column.querySelector('.calendar-week-day-header.today, .calendar-week-day-header .today, .today')
        ));
    }

    if (todayIndex < 0) {
        todayIndex = dayColumns.findIndex((column) => Boolean(
            column.classList.contains('today') || column.querySelector('.calendar-week-day-header.today, .today')
        ));
    }

    if (todayIndex < 0 && dayColumns.length === 1) {
        todayIndex = 0;
    }

    entries.forEach((entry) => {
        entry.classList.remove('isy-tt-past-lesson');

        const wrapper = entry.closest('.calendar-week-element');
        if (!wrapper) return;

        const scope = wrapper.getAttribute('data-scope');
        const styleText = (wrapper.getAttribute('style') || '').toLowerCase();
        let isPast = false;

        if (weekStatus === 'past') {
            isPast = true;
        } else if (weekStatus === 'future') {
            isPast = false;
        } else if (scope === 'allDay') {
            const allDayColumn = wrapper.closest('.day-all-column, .calendar-week-day');
            const allDayIndex = allDayColumns.indexOf(allDayColumn);
            if (todayIndex >= 0 && allDayIndex >= 0) {
                isPast = allDayIndex < todayIndex;
            }
        } else {
            const dayColumn = wrapper.closest('.calendar-week-day');
            const dayIndex = dayColumns.indexOf(dayColumn);

            if (todayIndex >= 0 && dayIndex >= 0) {
                if (dayIndex < todayIndex) {
                    isPast = true;
                } else if (dayIndex === todayIndex && currentTimePercent !== null) {
                    const top = parsePercentVariable(styleText, '--top');
                    const height = parsePercentVariable(styleText, '--height');
                    if (top !== null && height !== null) {
                        isPast = (top + height) <= (currentTimePercent + 0.1);
                    }
                }
            } else if (todayIndex < 0 && dayColumns.length === 1 && currentTimePercent !== null) {
                const top = parsePercentVariable(styleText, '--top');
                const height = parsePercentVariable(styleText, '--height');
                if (top !== null && height !== null) {
                    isPast = (top + height) <= (currentTimePercent + 0.1);
                }
            }
        }

        if (isPast) {
            entry.classList.add('isy-tt-past-lesson');
        }
    });
}

function applyTimetableClasses(entries) {
    applyTimetableSpecialCaseClasses(entries);
    applyPastLessonClasses(entries);
}

function applyTimetableSpecialCaseClasses(entries) {
    entries.forEach((entry) => {
        const wrapper = entry.closest('.calendar-week-element');
        const labelText = (entry.querySelector('.content-header-label span')?.textContent || '')
            .toLowerCase()
            .replace(/\u00e4/g, 'ae')
            .replace(/\u00f6/g, 'oe')
            .replace(/\u00fc/g, 'ue')
            .replace(/\u00df/g, 'ss');
        const classText = `${entry.className || ''} ${wrapper?.className || ''}`.toLowerCase();
        const styleText = `${entry.getAttribute('style') || ''} ${wrapper?.getAttribute('style') || ''}`.toLowerCase();
        const hasClass = (className) => classText.includes(className.toLowerCase());

        entry.classList.remove(
            'isy-tt-exam-text',
            'isy-tt-canceled-task-text',
            'isy-tt-canceled-text',
            'isy-tt-absence-text',
            'isy-tt-shifted-text',
            'isy-tt-special-text'
        );

        const hasStrikeThrough = hasClass('line-through')
            || styleText.includes('line-through')
            || Boolean(entry.querySelector('.line-through, [class*="line-through"], [style*="line-through"]'));

        const isBlueLesson = styleText.includes('31, 161, 219')
            || styleText.includes('31,161,219')
            || styleText.includes('173, 226, 252')
            || styleText.includes('173,226,252');
        const isShifted = labelText.includes('verschoben')
            || labelText.includes('verlegt')
            || labelText.includes('shifted')
            || hasClass('calendar-coloring--isshifted')
            || hasClass('calendar-coloring--ispredecessorshifted')
            || styleText.includes('253, 146, 0')
            || styleText.includes('253,146,0');
        const isCanceled = labelText.includes('entfaellt')
            || labelText.includes('entfallt')
            || labelText.includes('faellt aus')
            || labelText.includes('ausfall')
            || labelText.includes('cancel')
            || hasClass('calendar-coloring--iscanceled')
            || styleText.includes('242, 242, 242')
            || styleText.includes('242,242,242')
            || hasStrikeThrough;
        const hasTask = labelText.includes('auftrag')
            || labelText.includes('task')
            || hasClass('calendar-coloring--hasregistration')
            || styleText.includes('253, 242, 141')
            || styleText.includes('253,242,141');
        const isSpecial = labelText.includes('sonder')
            || labelText.includes('special')
            || hasClass('calendar-coloring--iscollection')
            || styleText.includes('211, 211, 211')
            || styleText.includes('211,211,211');
        const isAbsence = labelText.includes('absence')
            || labelText.includes('abwesen')
            || hasClass('calendar-coloring--isabsence');

        const isExam = (labelText.includes('pruefung')
            || labelText.includes('prufung')
            || labelText.includes('klausur')
            || labelText.includes('exam')
            || hasClass('calendar-coloring--isexam')
            || isBlueLesson) && !isCanceled;

        if (isCanceled && (hasTask || isBlueLesson)) {
            entry.classList.add('isy-tt-canceled-task-text');
        } else if (isCanceled) {
            entry.classList.add('isy-tt-canceled-text');
        } else if (isExam) {
            entry.classList.add('isy-tt-exam-text');
        } else if (isAbsence) {
            entry.classList.add('isy-tt-absence-text');
        } else if (isShifted) {
            entry.classList.add('isy-tt-shifted-text');
        } else if (isSpecial) {
            entry.classList.add('isy-tt-special-text');
        }
    });
}

let timetablePastRefreshInterval = null;
function ensureTimetablePastRefresh() {
    if (timetablePastRefreshInterval !== null) return;

    timetablePastRefreshInterval = window.setInterval(() => {
        if (!window.location.href.includes('timetable')) return;

        const realItems = Array.from(document.querySelectorAll('.calendar-week-element-inner'))
            .filter((el) => !el.closest('#isy-cached-timetable'));
        if (realItems.length > 0) {
            applyPastLessonClasses(realItems);
        }
    }, 60000);
}


// --- Timetable Caching Logic ---
const TIMETABLE_CACHE_STORE_KEY = 'isy-timetable-week-cache-v2';
const LEGACY_CACHE_KEY = 'isy-timetable-cache';
const LEGACY_CACHE_TIMESTAMP_KEY = 'isy-timetable-timestamp';
const MAX_CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const PRELOAD_PREVIOUS_WEEKS = 2;
const PRELOAD_NEXT_WEEKS = 3;
const EXTENSION_VERSION = chrome.runtime?.getManifest?.().version || 'dev';

let timetablePreloadPromise = null;
let hasStartedPreloadInThisPage = false;

function shouldShowTimetableOverlay() {
    const href = window.location.href.toLowerCase();
    if (!href.includes('timetable')) return false;

    // Do not show cached timetable overlay on entry/create/edit views.
    if (/(add|new|create|neu|erstellen|appointment|termin|erfassen|edit|bearbeiten)/.test(href)) return false;

    // Extra safety for SPA states where URL is ambiguous but a form is already visible.
    if (document.querySelector('.form-container input, .form-container textarea, .form-container select')) return false;

    return true;
}

function removeCachedTimetableOverlay() {
    const overlay = document.getElementById('isy-cached-timetable');
    if (overlay) overlay.remove();
}

function decorateFooter() {
    const footer = document.querySelector('.footer');
    if (!footer) return;

    footer.classList.add('isy-footer-themed');

    const rightArea = footer.querySelector('.w-36.text-right') || footer.lastElementChild;
    if (!rightArea) return;

    if (!rightArea.querySelector('.arthasmod-version')) {
        const versionEl = document.createElement('a');
        versionEl.className = 'arthasmod-version';
        versionEl.href = 'https://github.com/Arthas1811';
        versionEl.target = '_blank';
        versionEl.rel = 'noopener noreferrer';
        versionEl.textContent = `ArthasMod v.${EXTENSION_VERSION}`;
        rightArea.prepend(versionEl);
    }
}

function getRealTimetableScaffold() {
    return Array.from(document.querySelectorAll('.time-table-scaffold'))
        .find((el) => !el.closest('#isy-cached-timetable')) || null;
}

function getWeekKeyFromScaffold(scaffold) {
    if (!scaffold) return null;

    const headerColumns = Array.from(scaffold.querySelectorAll(
        '.day-header-container .calendar-week-day, .day-header-container .calendar-week-day-header, .day-header-container .cwd-header-label'
    ));
    const dates = headerColumns
        .map((column) => parseHeaderDate(column.textContent || ''))
        .filter(Boolean);

    return getWeekKeyFromDates(dates);
}

function getWeekKeyFromUrl(url = window.location.href) {
    const match = url.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;

    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const day = Number.parseInt(match[3], 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return null;

    return formatDateAsWeekKey(getStartOfIsoWeek(date));
}

function getOverlayWeekKey() {
    return getWeekKeyFromUrl() || getCurrentWeekKey();
}

function readTimetableCacheStore() {
    const fallback = { weeks: {} };

    const raw = localStorage.getItem(TIMETABLE_CACHE_STORE_KEY);
    if (!raw) return fallback;

    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return fallback;
        if (!parsed.weeks || typeof parsed.weeks !== 'object') return fallback;
        return { weeks: parsed.weeks };
    } catch {
        return fallback;
    }
}

function pruneTimetableCache(store) {
    const now = Date.now();
    const entries = Object.entries(store.weeks || {})
        .filter(([, entry]) => (
            entry
            && typeof entry.html === 'string'
            && typeof entry.savedAt === 'number'
            && (now - entry.savedAt) < MAX_CACHE_AGE_MS
        ))
        .sort((a, b) => b[1].savedAt - a[1].savedAt)
        .slice(0, 16);

    store.weeks = Object.fromEntries(entries);
    return store;
}

function writeTimetableCacheStore(store) {
    try {
        localStorage.setItem(TIMETABLE_CACHE_STORE_KEY, JSON.stringify(pruneTimetableCache(store)));
        return true;
    } catch (error) {
        console.warn('Isy Modernizer: Could not persist timetable cache.', error);
        return false;
    }
}

function getCachedWeekHtml(weekKey) {
    const store = pruneTimetableCache(readTimetableCacheStore());
    const cachedEntry = store.weeks?.[weekKey];
    if (cachedEntry && typeof cachedEntry.html === 'string') {
        return cachedEntry.html;
    }

    if (weekKey !== getCurrentWeekKey()) return null;

    const legacyHtml = localStorage.getItem(LEGACY_CACHE_KEY);
    const legacyTimestamp = Number.parseInt(localStorage.getItem(LEGACY_CACHE_TIMESTAMP_KEY) || '', 10);
    if (!legacyHtml || !Number.isFinite(legacyTimestamp)) return null;
    if ((Date.now() - legacyTimestamp) >= MAX_CACHE_AGE_MS) return null;

    return legacyHtml;
}

function createCacheHtmlFromScaffold(scaffold) {
    const clone = scaffold.cloneNode(true);
    const existingOverlay = clone.querySelector('#isy-cached-timetable');
    if (existingOverlay) existingOverlay.remove();

    clone.querySelectorAll('.tts-header, .day-header-container, .week-header-row, .time-strip-toggle-container')
        .forEach((el) => el.remove());

    return clone.innerHTML;
}

function saveScaffoldToWeekCache(scaffold, explicitWeekKey = null) {
    if (!scaffold) return null;

    const weekKey = explicitWeekKey || getWeekKeyFromScaffold(scaffold);
    if (!weekKey) return null;

    const html = createCacheHtmlFromScaffold(scaffold);
    if (!html) return null;

    const store = readTimetableCacheStore();
    if (!store.weeks || typeof store.weeks !== 'object') {
        store.weeks = {};
    }
    store.weeks[weekKey] = { html, savedAt: Date.now() };
    writeTimetableCacheStore(store);

    if (weekKey === getCurrentWeekKey()) {
        try {
            localStorage.setItem(LEGACY_CACHE_KEY, html);
            localStorage.setItem(LEGACY_CACHE_TIMESTAMP_KEY, Date.now().toString());
        } catch {
            // ignore storage fallback errors
        }
    }

    return weekKey;
}

function waitForWeekKeyChange(previousWeekKey, timeoutMs = 15000) {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
        const check = () => {
            if (!shouldShowTimetableOverlay()) {
                reject(new Error('Not on timetable view anymore.'));
                return;
            }

            const scaffold = getRealTimetableScaffold();
            const weekKey = getWeekKeyFromScaffold(scaffold);
            if (scaffold && weekKey && weekKey !== previousWeekKey) {
                resolve({ scaffold, weekKey });
                return;
            }

            if ((Date.now() - startedAt) >= timeoutMs) {
                reject(new Error('Timed out waiting for a week change.'));
                return;
            }

            window.setTimeout(check, 120);
        };

        check();
    });
}

function waitForWeekKey(targetWeekKey, timeoutMs = 15000) {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
        const check = () => {
            if (!shouldShowTimetableOverlay()) {
                reject(new Error('Not on timetable view anymore.'));
                return;
            }

            const scaffold = getRealTimetableScaffold();
            const weekKey = getWeekKeyFromScaffold(scaffold);
            if (scaffold && weekKey && weekKey === targetWeekKey) {
                resolve({ scaffold, weekKey });
                return;
            }

            if ((Date.now() - startedAt) >= timeoutMs) {
                reject(new Error(`Timed out waiting for week ${targetWeekKey}.`));
                return;
            }

            window.setTimeout(check, 120);
        };

        check();
    });
}

function getClickableAncestor(element) {
    if (!element) return null;
    return element.closest('button, a, [role="button"], .cursor-pointer') || element;
}

function triggerElementClick(element) {
    const clickable = getClickableAncestor(element);
    if (!clickable) return false;

    clickable.click();
    return true;
}

function getTimetableCurrentWeekButton() {
    const scaffold = getRealTimetableScaffold();
    if (!scaffold) return null;
    return getClickableAncestor(scaffold.querySelector('.tts-header .current-week-button'));
}

function getTimetableNavigationButton(direction) {
    const iconName = direction === 'previous' ? 'chevron-left' : 'chevron-right';
    const scaffold = getRealTimetableScaffold();
    if (!scaffold) return null;

    const header = scaffold.querySelector('.tts-header');
    if (!header) return null;

    const icon = header.querySelector(`svg[data-icon="${iconName}"], i.fa-${iconName}, .fa-${iconName}`);
    return getClickableAncestor(icon);
}

async function clickAndCacheWeek(button, mode = 'change', targetWeekKey = null) {
    if (!button) return getWeekKeyFromScaffold(getRealTimetableScaffold());

    const previousWeekKey = getWeekKeyFromScaffold(getRealTimetableScaffold());
    if (!triggerElementClick(button)) return previousWeekKey;

    try {
        const result = (mode === 'target' && targetWeekKey)
            ? await waitForWeekKey(targetWeekKey)
            : await waitForWeekKeyChange(previousWeekKey);

        if (result?.scaffold) {
            saveScaffoldToWeekCache(result.scaffold, result.weekKey);
        }

        return result?.weekKey || previousWeekKey;
    } catch {
        const scaffold = getRealTimetableScaffold();
        const weekKey = getWeekKeyFromScaffold(scaffold);
        if (scaffold && weekKey) {
            saveScaffoldToWeekCache(scaffold, weekKey);
        }
        return weekKey || previousWeekKey;
    }
}

async function preloadNeighborWeeksInBackground() {
    if (!shouldShowTimetableOverlay()) return;

    const initialScaffold = getRealTimetableScaffold();
    if (!initialScaffold) return;

    saveScaffoldToWeekCache(initialScaffold);

    const currentWeekKey = getCurrentWeekKey();
    let displayedWeekKey = getWeekKeyFromScaffold(initialScaffold);

    if (displayedWeekKey !== currentWeekKey) {
        displayedWeekKey = await clickAndCacheWeek(getTimetableCurrentWeekButton(), 'target', currentWeekKey);
    }

    for (let i = 0; i < PRELOAD_PREVIOUS_WEEKS; i += 1) {
        if (!shouldShowTimetableOverlay()) return;
        displayedWeekKey = await clickAndCacheWeek(getTimetableNavigationButton('previous'));
    }

    displayedWeekKey = await clickAndCacheWeek(getTimetableCurrentWeekButton(), 'target', currentWeekKey);

    for (let i = 0; i < PRELOAD_NEXT_WEEKS; i += 1) {
        if (!shouldShowTimetableOverlay()) return;
        displayedWeekKey = await clickAndCacheWeek(getTimetableNavigationButton('next'));
    }

    if (displayedWeekKey !== currentWeekKey) {
        await clickAndCacheWeek(getTimetableCurrentWeekButton(), 'target', currentWeekKey);
    }
}

function startBackgroundWeekPreloadIfReady() {
    if (hasStartedPreloadInThisPage || timetablePreloadPromise) return;
    if (!shouldShowTimetableOverlay()) return;

    const scaffold = getRealTimetableScaffold();
    if (!scaffold) return;
    if (!getWeekKeyFromScaffold(scaffold)) return;

    if (!getTimetableCurrentWeekButton()) return;
    if (!getTimetableNavigationButton('previous')) return;
    if (!getTimetableNavigationButton('next')) return;

    hasStartedPreloadInThisPage = true;
    timetablePreloadPromise = preloadNeighborWeeksInBackground()
        .catch((error) => {
            console.warn('Isy Modernizer: Week preloading failed.', error);
        })
        .finally(() => {
            timetablePreloadPromise = null;
        });
}

function applyCachedTimetable() {
    console.log("Isy Modernizer: Checking cache for timetable...");
    // Only run on the main timetable view
    if (!shouldShowTimetableOverlay()) return;

    // Avoid double overlay
    if (document.getElementById('isy-cached-timetable')) return;

    // Don't show cache if real content is already here
    // Exclude our own overlay from this check using :not() is risky if implementation varies, 
    // so we check for calendar items that are NOT inside our specific ID.
    const realItems = Array.from(document.querySelectorAll('.calendar-week-element-inner'))
        .filter(el => !el.closest('#isy-cached-timetable'));
    if (realItems.length > 0) {
        console.log("Isy Modernizer: Real content already present, skipping cache.");
        return;
    }

    const overlayWeekKey = getOverlayWeekKey();
    const cachedHTML = getCachedWeekHtml(overlayWeekKey);

    if (cachedHTML) {
        // Appending to body is safest for "loading screen" effect
        const overlay = document.createElement('div');
        overlay.id = 'isy-cached-timetable';
        overlay.dataset.weekKey = overlayWeekKey;
        overlay.style.position = 'fixed'; // Fixed to cover viewport even if scrolled
        overlay.style.top = '64px'; // Offset for navbar (approx)
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = 'calc(100vh - 64px)';
        overlay.style.zIndex = '99999'; // FORCE on top
        overlay.style.pointerEvents = 'none'; // Click through
        overlay.style.opacity = '1.0'; // Fully opaque to hide the spinner underneath
        overlay.style.backgroundColor = 'var(--isy-bg-gradient, #1a1b1a)'; // Match theme background
        overlay.style.filter = 'grayscale(0.2)'; // Slight visual cue it's cached, or just clean
        overlay.style.overflow = 'hidden';

        overlay.innerHTML = cachedHTML;
        // Never show duplicated header/navigation rows in cached overlay.
        overlay.querySelectorAll('.tts-header, .day-header-container, .week-header-row, .time-strip-toggle-container')
            .forEach((el) => el.remove());
        document.body.appendChild(overlay);
        console.log(`Isy Modernizer: Cached timetable applied for week ${overlayWeekKey}.`);
    }
}

// Global state to track URL (path + query + hash for SPA routes)
let currentUrl = window.location.href;

function startTimetableObserver() {
    const observer = new MutationObserver(() => {
        decorateFooter();

        const overlay = document.getElementById('isy-cached-timetable');

        // Safety: if we are no longer on a view where cache should appear, remove immediately.
        if (overlay && !shouldShowTimetableOverlay()) {
            removeCachedTimetableOverlay();
        }

        // 1. Detect SPA Navigation
        if (window.location.href !== currentUrl) {
            currentUrl = window.location.href;
            console.log("Isy Modernizer: Navigated to", currentUrl);
            if (shouldShowTimetableOverlay()) {
                applyCachedTimetable();
            } else {
                // If we left timetable, remove overlay immediately
                removeCachedTimetableOverlay();
            }
        }

        // 2. Check for Real Content Load
        // Important: Filter out elements that are inside our cache overlay!
        const realItems = Array.from(document.querySelectorAll('.calendar-week-element-inner'))
            .filter(el => !el.closest('#isy-cached-timetable'));
        const realScaffold = getRealTimetableScaffold();

        // As soon as the real timetable scaffold exists, remove the cache overlay
        // to avoid duplicated weekday/menu bars during week or mode switches.
        if (realScaffold) {
            removeCachedTimetableOverlay();
        }

        if (realItems.length > 0) {
            applyTimetableClasses(realItems);
        }

        // 3. Update Cache (Debounced)
        if (realScaffold && shouldShowTimetableOverlay()) {
            if (!window.saveCacheTimeout) {
                window.saveCacheTimeout = setTimeout(() => {
                    const scaffold = getRealTimetableScaffold();
                    if (scaffold) {
                        const weekKey = saveScaffoldToWeekCache(scaffold);
                        if (weekKey) {
                            console.log(`Isy Modernizer: Timetable cache updated for week ${weekKey}.`);
                        }
                    }
                    window.saveCacheTimeout = null;
                }, 900);
            }

            startBackgroundWeekPreloadIfReady();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // URL watchdog: some SPA transitions don't trigger a useful mutation immediately.
    window.setInterval(() => {
        if (window.location.href !== currentUrl) {
            currentUrl = window.location.href;
        }

        if (!shouldShowTimetableOverlay()) {
            removeCachedTimetableOverlay();
        }
    }, 400);
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        decorateFooter();
        applyCachedTimetable();
        startTimetableObserver();
        applyTimetableClasses(Array.from(document.querySelectorAll('.calendar-week-element-inner')));
        ensureTimetablePastRefresh();
        chrome.runtime.sendMessage({ action: 'SYNC_THEME' });
    });
} else {
    decorateFooter();
    applyCachedTimetable();
    startTimetableObserver();
    applyTimetableClasses(Array.from(document.querySelectorAll('.calendar-week-element-inner')));
    ensureTimetablePastRefresh();
    // Trigger preference sync
    chrome.runtime.sendMessage({ action: 'SYNC_THEME' });
}

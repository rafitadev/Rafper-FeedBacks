import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getDatabase, ref, push, onValue, off, query, orderByChild, limitToLast } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { getAuth, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const firebaseConfig = {
    apiKey: "AIzaSyBtTYMupsu0w6yAYPANKxsaxvLBBVDOqdU",
    authDomain: "rafper-feedbacks.firebaseapp.com",
    databaseURL: "https://rafper-feedbacks-default-rtdb.firebaseio.com",
    projectId: "rafper-feedbacks",
    storageBucket: "rafper-feedbacks.firebasestorage.app",
    messagingSenderId: "254959542657",
    appId: "1:254959542657:web:553e0e3b8ba9843d794880"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const feedbacksRef = ref(db, 'feedbacks');

const ROMS = ["HyperOS 1.0.2.0", "HyperOS 2.0.6.0", "HyperOS 2.0.8.0", "HyperOS 2.0.224", "Pitch Black Recovery"];

let currentUser = null;
let allFeedbacks = [];
let selectedRom = "all";
let currentRating = 0;
let unsubscribeFeedbacks = null;
const commentsUnsub = {};

const appEl = document.getElementById('app');
const toastEl = document.getElementById('toast');
const settingsModal = document.getElementById('settingsModal');
const authModal = document.getElementById('authModal');
const alertEl = document.getElementById('alert');

// ------------------------------------------------------------------
// Toast / alert
// ------------------------------------------------------------------
function toast(msg) {
    toastEl.textContent = msg;
    toastEl.dataset.show = '1';
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => { toastEl.dataset.show = '0'; }, 2600);
}

function showAlert(title, msg) {
    document.getElementById('alert-title').textContent = title;
    document.getElementById('alert-msg').textContent = msg;
    alertEl.dataset.open = '1';
}
document.getElementById('alert-cancel').addEventListener('click', () => { alertEl.dataset.open = '0'; });
document.getElementById('alert-go').addEventListener('click', () => { alertEl.dataset.open = '0'; });

// ------------------------------------------------------------------
// Nav / scroll state
// ------------------------------------------------------------------
window.addEventListener('scroll', () => {
    document.body.dataset.scrolled = window.scrollY > 10 ? '1' : '0';
}, { passive: true });

// ------------------------------------------------------------------
// Segmented control thumb
// ------------------------------------------------------------------
function moveThumb(seg) {
    if (!seg) return;
    const active = seg.querySelector('[aria-selected="true"]') || seg.querySelector('.seg__it');
    const thumb = seg.querySelector('.seg__thumb');
    if (!active || !thumb) return;
    thumb.style.width = active.offsetWidth + 'px';
    thumb.style.transform = 'translateX(' + active.offsetLeft + 'px)';
    seg.dataset.ready = '1';
}
function moveAllThumbs() {
    document.querySelectorAll('.seg').forEach(moveThumb);
}
window.addEventListener('resize', moveAllThumbs);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveAllThumbs);

// ------------------------------------------------------------------
// Settings modal
// ------------------------------------------------------------------
document.getElementById('settings-link').insertAdjacentHTML('beforeend',
    '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>');

document.getElementById('settings-link').addEventListener('click', (e) => {
    e.preventDefault();
    settingsModal.dataset.open = '1';
    updateAccountStatus();
});
document.getElementById('closeSettings').addEventListener('click', () => { settingsModal.dataset.open = '0'; });
settingsModal.querySelector('.settings-modal__bg').addEventListener('click', () => { settingsModal.dataset.open = '0'; });

// ------------------------------------------------------------------
// Theme
// ------------------------------------------------------------------
const themeSeg = document.getElementById('themeSeg');
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rafper_theme', theme);
    themeSeg.querySelectorAll('.seg__it').forEach(btn => {
        const active = btn.dataset.theme === theme;
        btn.setAttribute('aria-selected', active);
    });
    moveThumb(themeSeg);
}
themeSeg.querySelectorAll('.seg__it').forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
});
applyTheme(localStorage.getItem('rafper_theme') || 'alpha-style');

// ------------------------------------------------------------------
// Language
// ------------------------------------------------------------------
const translations = {
    en: {
        title: "Rafper Feedbacks",
        subtitle: "Feedback for Redmi Note 8 Custom ROMs",
        devices: "Devices:", recovery: "Recovery:",
        device_name: "Redmi Note 8 / 8T (Ginkgo/Willow)", recovery_name: "Pitch Black (S7/S7e/N7/NFE)",
        all_roms: "All ROMs", rom: "ROM",
        loading_feedbacks: "Loading feedbacks",
        submit_feedback: "Submit Feedback",
        your_name: "Your Name / Nickname",
        post_anonymous: "Post as Anonymous",
        your_rating: "Your Rating",
        your_feedback: "Your Feedback",
        submit: "Submit Feedback",
        submitting: "Submitting...",
        received_feedbacks: "Received Feedbacks",
        empty_no_feedback: "No feedback yet. Be the first!",
        empty_rom: "No feedback for this ROM yet.",
        fill_fields: "Please fill all fields and select a rating!",
        fill_name_or_anon: "Enter name or check Anonymous",
        success: "Feedback submitted!",
        error_submit: "Failed to submit.",
        comments: "Comments",
        show_comments: "Show comments",
        hide_comments: "Hide comments",
        write_comment: "Write a comment...",
        post_comment: "Post",
        login_to_comment: "Sign in to comment",
        no_comments: "No comments yet",
        anonymous: "Anonymous", guest: "Guest",
        not_signed_in: "Not signed in",
        sign_in: "Sign In",
        sign_up: "Sign Up",
        create_account: "Create Account",
        sign_out: "Sign Out",
        or_continue: "Or continue as",
        continue_guest: "Continue as Guest",
        email: "Email",
        password: "Password",
        display_name: "Display Name",
        settings: "Settings",
        theme: "Theme",
        language: "Language",
        account: "Account"
    },
    es: {
        title: "Rafper Feedbacks",
        subtitle: "Feedback para ROMs personalizadas Redmi Note 8",
        devices: "Dispositivos:", recovery: "Recovery:",
        device_name: "Redmi Note 8 / 8T (Ginkgo/Willow)", recovery_name: "Pitch Black (S7/S7e/N7/NFE)",
        all_roms: "Todas las ROMs", rom: "ROM",
        loading_feedbacks: "Cargando feedbacks",
        submit_feedback: "Enviar Feedback",
        your_name: "Tu Nombre / Apodo",
        post_anonymous: "Publicar como Anónimo",
        your_rating: "Tu Valoración",
        your_feedback: "Tu Feedback",
        submit: "Enviar Feedback",
        submitting: "Enviando...",
        received_feedbacks: "Feedbacks Recibidos",
        empty_no_feedback: "Sin feedbacks. ¡Sé el primero!",
        empty_rom: "Sin feedbacks para esta ROM.",
        fill_fields: "¡Completa todos los campos y valoración!",
        fill_name_or_anon: "Ingresa nombre o marca Anónimo",
        success: "¡Feedback enviado!",
        error_submit: "Error al enviar.",
        comments: "Comentarios",
        show_comments: "Ver comentarios",
        hide_comments: "Ocultar comentarios",
        write_comment: "Escribe un comentario...",
        post_comment: "Publicar",
        login_to_comment: "Inicia sesión para comentar",
        no_comments: "Sin comentarios",
        anonymous: "Anónimo", guest: "Invitado",
        not_signed_in: "No has iniciado sesión",
        sign_in: "Iniciar Sesión",
        sign_up: "Registrarse",
        create_account: "Crear Cuenta",
        sign_out: "Cerrar Sesión",
        or_continue: "O continúa como",
        continue_guest: "Continuar como Invitado",
        email: "Correo",
        password: "Contraseña",
        display_name: "Nombre",
        settings: "Ajustes",
        theme: "Tema",
        language: "Idioma",
        account: "Cuenta"
    },
    ru: {
        title: "Rafper Feedbacks",
        subtitle: "Отзывы для кастомных прошивок Redmi Note 8",
        devices: "Устройства:", recovery: "Recovery:",
        device_name: "Redmi Note 8 / 8T (Ginkgo/Willow)", recovery_name: "Pitch Black (S7/S7e/N7/NFE)",
        all_roms: "Все прошивки", rom: "Прошивка",
        loading_feedbacks: "Загрузка отзывов",
        submit_feedback: "Отправить отзыв",
        your_name: "Ваше имя",
        post_anonymous: "Анонимно",
        your_rating: "Ваша оценка",
        your_feedback: "Ваш отзыв",
        submit: "Отправить отзыв",
        submitting: "Отправка...",
        received_feedbacks: "Полученные отзывы",
        empty_no_feedback: "Отзывов пока нет. Будьте первым!",
        empty_rom: "Отзывов для этой прошивки нет.",
        fill_fields: "Заполните все поля и оценку!",
        fill_name_or_anon: "Введите имя или отметьте Анонимно",
        success: "Отзыв отправлен!",
        error_submit: "Ошибка отправки.",
        comments: "Комментарии",
        show_comments: "Показать",
        hide_comments: "Скрыть",
        write_comment: "Написать комментарий...",
        post_comment: "Отправить",
        login_to_comment: "Войдите, чтобы комментировать",
        no_comments: "Комментариев пока нет",
        anonymous: "Аноним", guest: "Гость",
        not_signed_in: "Вы не вошли",
        sign_in: "Войти",
        sign_up: "Регистрация",
        create_account: "Создать аккаунт",
        sign_out: "Выйти",
        or_continue: "Или продолжить как",
        continue_guest: "Продолжить как Гость",
        email: "Email",
        password: "Пароль",
        display_name: "Имя",
        settings: "Настройки",
        theme: "Тема",
        language: "Язык",
        account: "Аккаунт"
    },
    it: {
        title: "Rafper Feedbacks",
        subtitle: "Feedback per Custom ROM Redmi Note 8",
        devices: "Dispositivi:", recovery: "Recovery:",
        device_name: "Redmi Note 8 / 8T (Ginkgo/Willow)", recovery_name: "Pitch Black (S7/S7e/N7/NFE)",
        all_roms: "Tutte le ROM", rom: "ROM",
        loading_feedbacks: "Caricamento feedback",
        submit_feedback: "Invia Feedback",
        your_name: "Il tuo Nome",
        post_anonymous: "Pubblica come Anonimo",
        your_rating: "La tua Valutazione",
        your_feedback: "Il tuo Feedback",
        submit: "Invia Feedback",
        submitting: "Invio...",
        received_feedbacks: "Feedback Ricevuti",
        empty_no_feedback: "Nessun feedback. Sii il primo!",
        empty_rom: "Nessun feedback per questa ROM.",
        fill_fields: "Compila tutti i campi e la valutazione!",
        fill_name_or_anon: "Inserisci nome o spunta Anonimo",
        success: "Feedback inviato!",
        error_submit: "Errore invio.",
        comments: "Commenti",
        show_comments: "Mostra commenti",
        hide_comments: "Nascondi commenti",
        write_comment: "Scrivi un commento...",
        post_comment: "Invia",
        login_to_comment: "Accedi per commentare",
        no_comments: "Nessun commento",
        anonymous: "Anonimo", guest: "Ospite",
        not_signed_in: "Non hai effettuato l'accesso",
        sign_in: "Accedi",
        sign_up: "Registrati",
        create_account: "Crea Account",
        sign_out: "Esci",
        or_continue: "O continua come",
        continue_guest: "Continua come Ospite",
        email: "Email",
        password: "Password",
        display_name: "Nome",
        settings: "Impostazioni",
        theme: "Tema",
        language: "Lingua",
        account: "Account"
    }
};

let currentLang = localStorage.getItem('rafper_lang') || 'en';
const langSeg = document.getElementById('langSeg');

function t(key) {
    return (translations[currentLang] && translations[currentLang][key]) || translations.en[key] || key;
}

function locale() {
    return { en: 'en-US', es: 'es-ES', ru: 'ru-RU', it: 'it-IT' }[currentLang] || 'en-US';
}

function applyStaticI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPh);
    });
    document.documentElement.lang = currentLang;
}

function applyLang(lang) {
    currentLang = lang;
    localStorage.setItem('rafper_lang', currentLang);
    langSeg.querySelectorAll('.seg__it').forEach(btn => {
        btn.setAttribute('aria-selected', btn.dataset.lang === currentLang);
    });
    moveThumb(langSeg);
    applyStaticI18n();
    updateAccountStatus();
    render();
}
langSeg.querySelectorAll('.seg__it').forEach(btn => {
    btn.addEventListener('click', () => applyLang(btn.dataset.lang));
});

// ------------------------------------------------------------------
// Auth
// ------------------------------------------------------------------
document.getElementById('openAuthFromSettings').addEventListener('click', () => {
    settingsModal.dataset.open = '0';
    authModal.dataset.open = '1';
});
document.getElementById('closeAuthModal').addEventListener('click', () => { authModal.dataset.open = '0'; });
authModal.querySelector('.auth-modal__bg').addEventListener('click', () => { authModal.dataset.open = '0'; });

document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(x => x.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        document.getElementById(tab.dataset.tab === 'login' ? 'loginForm' : 'signupForm').classList.add('active');
    });
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await signInWithEmailAndPassword(auth,
            document.getElementById('loginEmail').value.trim(),
            document.getElementById('loginPassword').value);
        authModal.dataset.open = '0';
        e.target.reset();
        toast(t('sign_in') + ' ✓');
    } catch (err) {
        showAlert(t('sign_in'), friendlyAuthError(err));
    }
});

document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const cred = await createUserWithEmailAndPassword(auth,
            document.getElementById('signupEmail').value.trim(),
            document.getElementById('signupPassword').value);
        await updateProfile(cred.user, { displayName: document.getElementById('signupName').value.trim() });
        authModal.dataset.open = '0';
        e.target.reset();
        toast(t('sign_up') + ' ✓');
    } catch (err) {
        showAlert(t('sign_up'), friendlyAuthError(err));
    }
});

document.getElementById('guestSignIn').addEventListener('click', async () => {
    try {
        await signInAnonymously(auth);
        authModal.dataset.open = '0';
        toast('✓');
    } catch (err) {
        showAlert(t('continue_guest'), friendlyAuthError(err));
    }
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
    await signOut(auth);
    toast(t('sign_out'));
});

function friendlyAuthError(err) {
    const code = (err && err.code) || '';
    if (code.includes('configuration-not-found')) return 'Auth provider not enabled. Enable Email/Password + Anonymous in Firebase Console → Authentication → Sign-in method.';
    if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'Wrong email or password.';
    if (code.includes('email-already-in-use')) return 'This email is already registered.';
    if (code.includes('weak-password')) return 'Password must be at least 6 characters.';
    if (code.includes('invalid-email')) return 'Invalid email address.';
    if (code.includes('network-request-failed')) return 'Network error. Check your connection.';
    return (err && err.message) || 'Unknown error.';
}

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateAccountStatus();
    render();
});

function updateAccountStatus() {
    const el = document.getElementById('accountStatus');
    const outBtn = document.getElementById('signOutBtn');
    const authBtn = document.getElementById('openAuthFromSettings');
    if (currentUser) {
        const name = currentUser.displayName || (currentUser.email && currentUser.email.split('@')[0]) || (currentUser.isAnonymous ? t('anonymous') : t('guest'));
        el.textContent = name;
        outBtn.style.display = '';
        authBtn.style.display = 'none';
    } else {
        el.textContent = t('not_signed_in');
        outBtn.style.display = 'none';
        authBtn.style.display = '';
    }
}

// ------------------------------------------------------------------
// Render
// ------------------------------------------------------------------
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

function render() {
    currentRating = 0;
    const filtered = selectedRom === 'all' ? allFeedbacks : allFeedbacks.filter(f => f.rom === selectedRom);
    const sorted = filtered.slice().reverse();

    let html = `
    <div class="hero">
        <h1>${t('title')}</h1>
        <p>${t('subtitle')}</p>
        <div class="device-badge">
            <span class="device-label">${t('devices')}</span> ${t('device_name')}
            <span style="opacity:.4">|</span>
            <span class="recovery-label">${t('recovery')}</span> ${t('recovery_name')}
        </div>
    </div>

    <div class="seg" id="romSeg" data-ready="0">
        <div class="seg__thumb"></div>
        <button type="button" class="seg__it" data-rom="all" aria-selected="${selectedRom === 'all'}">${t('all_roms')}</button>
        ${ROMS.map(r => `
        <button type="button" class="seg__it" data-rom="${escapeHtml(r)}" aria-selected="${selectedRom === r}">${escapeHtml(r)}
            ${r.indexOf('Recovery') > -1
                ? '<span class="badge" style="background:#7b2ff7">S7/N7</span>'
                : '<span class="badge">' + (r.indexOf('2.0.224') > -1 ? '15' : '14') + '</span>'}
        </button>`).join('')}
    </div>

    <div class="cap">${t('submit_feedback')}</div>
    <form class="feedback-form" id="feedbackForm" novalidate>
        <div class="form-group">
            <label for="feedbackRom">${t('rom')}</label>
            <select id="feedbackRom">
                ${ROMS.map(r => `<option value="${escapeHtml(r)}" ${selectedRom === r ? 'selected' : ''}>${escapeHtml(r)}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label for="author">${t('your_name')}</label>
            <input type="text" id="author" maxlength="30" data-i18n-ph="your_name" placeholder="${t('your_name')}...">
            <label class="checkbox-label">
                <input type="checkbox" id="anonymousCheck"> ${t('post_anonymous')}
            </label>
        </div>
        <div class="form-group">
            <label>${t('your_rating')}</label>
            <div class="rating" id="rating">
                ${[1,2,3,4,5].map(n => `<input type="radio" name="rating" id="star${n}" value="${n}"><label for="star${n}" data-value="${n}" aria-label="${n} star">★</label>`).join('')}
            </div>
        </div>
        <div class="form-group">
            <label for="feedback">${t('your_feedback')}</label>
            <textarea id="feedback" rows="4" maxlength="1000" data-i18n-ph="your_feedback" placeholder="${t('your_feedback')}..." required></textarea>
        </div>
        <button type="submit" class="btn-submit" id="submitBtn">${t('submit')}</button>
    </form>

    <div class="cap">${t('received_feedbacks')}<span>${sorted.length}</span></div>
    `;

    if (sorted.length === 0) {
        html += `<div class="card"><div class="empty"><h3>${selectedRom === 'all' ? t('empty_no_feedback') : t('empty_rom')}</h3></div></div>`;
    } else {
        html += sorted.map(fb => `
        <div class="feedback-item" data-id="${escapeHtml(fb.id)}">
            <div class="feedback-header">
                <span class="feedback-rom">${escapeHtml(fb.rom)}</span>
                <span class="feedback-date">${formatDate(fb.date)}</span>
            </div>
            <div class="feedback-author">${escapeHtml(fb.author)}</div>
            <div class="feedback-rating" aria-label="${fb.rating} / 5">${'★'.repeat(Math.min(5, fb.rating || 0))}${'☆'.repeat(Math.max(0, 5 - (fb.rating || 0)))}</div>
            <div class="feedback-text">${escapeHtml(fb.text)}</div>
            <div class="comments-section">
                <div class="comments-header">
                    <span>${t('comments')}</span>
                    <button type="button" class="comments-toggle" data-id="${escapeHtml(fb.id)}" aria-expanded="false">${t('show_comments')}</button>
                </div>
                <div class="comments-list" id="comments-list-${escapeHtml(fb.id)}" style="display:none;"></div>
                <div class="comment-area" id="comment-area-${escapeHtml(fb.id)}" style="display:none;">
                    ${currentUser ? `
                    <form class="comment-form" data-id="${escapeHtml(fb.id)}">
                        <textarea placeholder="${t('write_comment')}" maxlength="500" required></textarea>
                        <button type="submit" class="comment-submit">${t('post_comment')}</button>
                    </form>` : `
                    <div class="login-prompt">
                        <span>${t('login_to_comment')}</span>
                        <button type="button" class="open-auth-from-comment">${t('sign_in')}</button>
                    </div>`}
                </div>
            </div>
        </div>`).join('');
    }

    appEl.innerHTML = html;
    attachEvents();
    moveThumb(document.getElementById('romSeg'));
}

function formatDate(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' });
}

function attachEvents() {
    document.querySelectorAll('#romSeg .seg__it').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedRom = btn.dataset.rom;
            render();
        });
    });

    document.querySelectorAll('.rating label').forEach(label => {
        label.addEventListener('click', () => {
            currentRating = parseInt(label.dataset.value, 10) || 0;
            document.querySelectorAll('.rating label').forEach(l => {
                l.classList.toggle('filled', (parseInt(l.dataset.value, 10) || 0) <= currentRating);
            });
        });
    });

    const anonCheck = document.getElementById('anonymousCheck');
    const authorInput = document.getElementById('author');
    if (anonCheck && authorInput) {
        anonCheck.addEventListener('change', () => {
            authorInput.disabled = anonCheck.checked;
            if (anonCheck.checked) authorInput.value = '';
        });
    }

    const form = document.getElementById('feedbackForm');
    if (form) form.addEventListener('submit', submitFeedback);

    document.querySelectorAll('.comments-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const list = document.getElementById('comments-list-' + id);
            const area = document.getElementById('comment-area-' + id);
            const opening = list.style.display === 'none';
            list.style.display = opening ? 'block' : 'none';
            area.style.display = opening ? 'block' : 'none';
            btn.textContent = opening ? t('hide_comments') : t('show_comments');
            btn.setAttribute('aria-expanded', String(opening));
            if (opening) loadComments(id);
            else stopComments(id);
        });
    });

    document.querySelectorAll('.comment-form').forEach(cForm => {
        cForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = cForm.dataset.id;
            const textarea = cForm.querySelector('textarea');
            const text = textarea.value.trim();
            if (!text || !currentUser) return;
            const btn = cForm.querySelector('.comment-submit');
            btn.disabled = true;
            try {
                await push(ref(db, 'feedbacks/' + id + '/comments'), {
                    author: currentUser.displayName || (currentUser.email && currentUser.email.split('@')[0]) || (currentUser.isAnonymous ? t('anonymous') : t('guest')),
                    text: text,
                    date: new Date().toISOString()
                });
                textarea.value = '';
            } catch (err) {
                console.error(err);
                showAlert(t('comments'), err.message || 'Error');
            } finally {
                btn.disabled = false;
            }
        });
    });

    document.querySelectorAll('.open-auth-from-comment').forEach(btn => {
        btn.addEventListener('click', () => { authModal.dataset.open = '1'; });
    });
}

async function submitFeedback(e) {
    e.preventDefault();
    const anonCheck = document.getElementById('anonymousCheck');
    const authorInput = document.getElementById('author');
    const textEl = document.getElementById('feedback');
    const btn = document.getElementById('submitBtn');
    const isAnon = anonCheck.checked;
    const author = isAnon ? t('anonymous') : authorInput.value.trim();
    const text = textEl.value.trim();
    const rom = document.getElementById('feedbackRom').value;

    if (!isAnon && !author) { toast(t('fill_name_or_anon')); return; }
    if (!text || currentRating === 0) { toast(t('fill_fields')); return; }

    btn.disabled = true;
    btn.textContent = t('submitting');
    try {
        await push(feedbacksRef, {
            rom: rom,
            author: author,
            rating: currentRating,
            text: text,
            date: new Date().toISOString()
        });
        toast(t('success'));
    } catch (err) {
        console.error(err);
        showAlert(t('submit'), t('error_submit') + ' ' + (err.message || ''));
    } finally {
        btn.disabled = false;
        btn.textContent = t('submit');
    }
}

// ------------------------------------------------------------------
// Comments
// ------------------------------------------------------------------
function loadComments(feedbackId) {
    stopComments(feedbackId);
    const q = query(ref(db, 'feedbacks/' + feedbackId + '/comments'), orderByChild('date'), limitToLast(50));
    commentsUnsub[feedbackId] = onValue(q, (snap) => {
        const listEl = document.getElementById('comments-list-' + feedbackId);
        if (!listEl) return;
        const data = snap.val();
        if (!data) {
            listEl.innerHTML = '<div class="empty-state">' + t('no_comments') + '</div>';
            return;
        }
        const comments = Object.keys(data).map(key => ({ id: key, ...data[key] }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        listEl.innerHTML = comments.map(c => `
            <div class="comment-item">
                <div class="comment-header">
                    <span class="comment-author">${escapeHtml(c.author)}</span>
                    <span class="comment-date">${formatDate(c.date)}</span>
                </div>
                <div class="comment-text">${escapeHtml(c.text)}</div>
            </div>`).join('');
    }, (err) => {
        console.error('comments error:', err);
    });
}

function stopComments(feedbackId) {
    if (commentsUnsub[feedbackId]) {
        commentsUnsub[feedbackId]();
        delete commentsUnsub[feedbackId];
    }
}

// ------------------------------------------------------------------
// Listen to feedbacks
// ------------------------------------------------------------------
function listenFeedbacks() {
    if (unsubscribeFeedbacks) unsubscribeFeedbacks();
    const q = query(feedbacksRef, orderByChild('date'), limitToLast(100));
    unsubscribeFeedbacks = onValue(q, (snap) => {
        const data = snap.val();
        allFeedbacks = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
        render();
    }, (err) => {
        console.error('Firebase error:', err);
        appEl.innerHTML = '<div class="empty"><h3>Connection error</h3><p>Could not load feedbacks from Firebase.</p></div>';
    });
}

// ------------------------------------------------------------------
// Init
// ------------------------------------------------------------------
applyStaticI18n();
updateAccountStatus();
listenFeedbacks();

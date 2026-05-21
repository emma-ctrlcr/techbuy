/* ══════════════════════════════════════════════════════════════
   CONTACTO PAGE — contacto.js
   Carga: datos.js
══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  TB_loadCart();
  TB_setupSharedHeader();
  TB_setupSearchAutocomplete();
  TB_setupCartSidebar();
  TB_setupAccountBtn();

  setupContactForm();

  // Phone input
  document.getElementById("contactPhone").addEventListener("input", function() {
    this.value = this.value.replace(/\D/g, "").slice(0, 8);
  });
});

function setupContactForm() {
  document.getElementById("contactForm").addEventListener("submit", e => {
    e.preventDefault();

    const name = document.getElementById("contactName").value.trim();
    const email = document.getElementById("contactEmail").value.trim();
    const phone = document.getElementById("contactPhone").value.trim();
    const subject = document.getElementById("contactSubject").value;
    const message = document.getElementById("contactMessage").value.trim();

    // Validation
    if (!name) { shakeField("contactName"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { shakeField("contactEmail"); return; }
    if (!subject) { shakeField("contactSubject"); return; }
    if (!message || message.length < 10) {
      TB_showToast('<i class="fa-solid fa-triangle-exclamation"></i>', "Escribe un mensaje de al menos 10 caracteres");
      return;
    }

    // Save to localStorage
    const contact = { name, email, phone, subject, message, date: new Date().toLocaleString("es-ES") };
    const contacts = JSON.parse(localStorage.getItem("techbuy_contacts") || "[]");
    contacts.unshift(contact);
    localStorage.setItem("techbuy_contacts", JSON.stringify(contacts));

    TB_showToast('<i class="fa-solid fa-check-circle"></i>', "Mensaje enviado! Te responderemos pronto.");
    document.getElementById("contactForm").reset();
  });
}

function shakeField(id) {
  const el = document.getElementById(id);
  el.style.animation = "none";
  el.offsetHeight;
  el.style.animation = "shake 0.4s ease";
}

function toggleFaq(el) {
  const item = el.closest(".contact-faq-item");
  const a = item.querySelector(".contact-faq-a");
  const icon = item.querySelector(".fa-chevron-down");
  const isOpen = a.style.display === "block";
  document.querySelectorAll(".contact-faq-a").forEach(x => x.style.display = "none");
  document.querySelectorAll(".contact-faq-item .fa-chevron-down").forEach(x => x.style.transform = "");
  if (!isOpen) { a.style.display = "block"; icon.style.transform = "rotate(180deg)"; }
}

window.toggleFaq = toggleFaq;
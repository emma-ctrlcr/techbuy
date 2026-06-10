document.addEventListener('DOMContentLoaded', async () => {
  await TB_loadCart();
  TB_setupSharedHeader();
  TB_setupSearchAutocomplete();
  TB_setupCartSidebar();
  TB_setupAccountBtn();

  setupContactForm();

  document.getElementById("contactPhone").addEventListener("input", function() {
    this.value = this.value.replace(/\D/g, "").slice(0, 8);
  });
});

function setupContactForm() {
  document.getElementById("contactForm").addEventListener("submit", async e => {
    e.preventDefault();

    const name = document.getElementById("contactName").value.trim();
    const email = document.getElementById("contactEmail").value.trim();
    const phone = document.getElementById("contactPhone").value.trim();
    const subject = document.getElementById("contactSubject").value;
    const message = document.getElementById("contactMessage").value.trim();

    if (!name) { shakeField("contactName"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { shakeField("contactEmail"); return; }
    if (!subject) { shakeField("contactSubject"); return; }
    if (!message || message.length < 10) {
      TB_showToast('<i class="fa-solid fa-triangle-exclamation"></i>', "Escribe un mensaje de al menos 10 caracteres");
      return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

    try {
      const res = await fetch('/api/store/mensajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: name,
          email: email,
          telefono: phone,
          asunto: subject,
          mensaje: message
        })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Error del servidor');

      console.log('[Contacto] Mensaje enviado, id:', data.mensaje?.id_contacto);
      TB_showToast('<i class="fa-solid fa-check-circle"></i>', "Mensaje enviado! Te responderemos pronto.");
      document.getElementById("contactForm").reset();
    } catch (err) {
      console.error('[Contacto] Error al enviar:', err);
      TB_showToast('<i class="fa-solid fa-circle-xmark"></i>', "Error: " + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar mensaje';
    }
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

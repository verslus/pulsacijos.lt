const WHATSAPP_NUMBER = "37068260352";
const CONTACT_EMAIL = "aleksejus@lapinoskrynia.lt";

const menuToggle = document.querySelector(".mobile-menu-toggle");
const mobileNav = document.querySelector(".mobile-nav");
const planButtons = document.querySelectorAll(".choose-plan");
const selectedPlanText = document.querySelector("#selectedPlanText");
const whatsappLink = document.querySelector("#waContactLink");
const toggleEmailForm = document.querySelector("#toggleEmailForm");
const emailPanel = document.querySelector("#email-panel");
const emailRegistrationForm = document.querySelector("#emailRegistrationForm");
const emailName = document.querySelector("#emailName");
const emailReply = document.querySelector("#emailReply");
const emailPhone = document.querySelector("#emailPhone");
const emailNote = document.querySelector("#emailNote");
const emailFormStatus = document.querySelector("#emailFormStatus");

const defaultPlan = "3 dienų seminaras - liepos 31 - rugpjūčio 2 d. Vilniuje - 350 €";

const getSelectedPlan = () => selectedPlanText?.textContent?.trim() || defaultPlan;

const buildMessage = () => {
  return `Sveiki, noriu registruotis į Olego Lapino Pulsacijas.\nPasirinktas formatas: ${getSelectedPlan()}.`;
};

const updateRegistrationLinks = () => {
  const message = buildMessage();
  if (whatsappLink) {
    whatsappLink.href = `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(message)}`;
  }
};

const selectPlan = (plan) => {
  if (selectedPlanText) selectedPlanText.textContent = plan;
  updateRegistrationLinks();
};

menuToggle?.addEventListener("click", () => {
  menuToggle.classList.toggle("active");
  mobileNav?.classList.toggle("active");
  document.body.classList.toggle("no-scroll");
});

document.querySelectorAll(".mobile-nav-link, .mobile-nav .btn").forEach((link) => {
  link.addEventListener("click", () => {
    menuToggle?.classList.remove("active");
    mobileNav?.classList.remove("active");
    document.body.classList.remove("no-scroll");
  });
});

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (event) => {
    const targetId = anchor.getAttribute("href");
    if (!targetId || targetId === "#") return;
    const targetElement = document.querySelector(targetId);
    if (!targetElement) return;
    event.preventDefault();
    const headerHeight = document.querySelector(".main-header")?.offsetHeight || 0;
    const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - headerHeight;
    window.scrollTo({ top: targetPosition, behavior: "smooth" });
  });
});

planButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const plan = button.dataset.plan || defaultPlan;
    selectPlan(plan);
    document.querySelector("#registracija")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

toggleEmailForm?.addEventListener("click", () => {
  const isOpen = emailPanel?.classList.toggle("open");
  toggleEmailForm.textContent = isOpen ? "Slėpti el. pašto formą" : "Registruotis el. paštu";
});

emailRegistrationForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = emailName?.value.trim();
  const email = emailReply?.value.trim();
  const phone = emailPhone?.value.trim();
  const note = emailNote?.value.trim();
  const plan = getSelectedPlan();

  if (!name || !email || !phone) return;

  const submitButton = emailRegistrationForm.querySelector("button[type='submit']");
  if (emailFormStatus) {
    emailFormStatus.textContent = "Siunčiama...";
    emailFormStatus.classList.remove("is-error", "is-success");
  }
  if (submitButton) submitButton.disabled = true;

  fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      email,
      phone,
      note,
      pageUrl: window.location.href,
      plan,
    }),
  })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Registracijos išsiųsti nepavyko.");
      }
      if (emailFormStatus) {
        emailFormStatus.textContent = "Registracija išsiųsta. Susisieksime el. paštu arba telefonu.";
        emailFormStatus.classList.add("is-success");
      }
      emailRegistrationForm.reset();
    })
    .catch((error) => {
      if (emailFormStatus) {
        emailFormStatus.textContent = error.message;
        emailFormStatus.classList.add("is-error");
      }
    })
    .finally(() => {
      if (submitButton) submitButton.disabled = false;
    });
});

updateRegistrationLinks();

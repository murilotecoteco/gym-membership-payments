/**
 * script.js
 * ------------------------------------------------------------------
 * Interações visuais e de UX da landing page (index.html).
 *
 * Não lida com autenticação nem pagamento (ver auth.js e pagamento.js);
 * é puramente responsável por comportamento de interface:
 *  - Menu mobile (abrir/fechar)
 *  - Vídeo principal (troca de thumbnail por iframe do YouTube ao clicar)
 *  - Accordion de perguntas frequentes (FAQ)
 *  - Carrossel de depoimentos/imagens
 *  - Animações de entrada ao rolar a página (reveal) e contador numérico
 *    animado (estatísticas)
 *  - Botão de contato (monta e abre uma mensagem pré-formatada no WhatsApp)
 *  - Efeito visual de "ripple" (onda) ao clicar em botões
 *  - Ano dinâmico no rodapé
 * ------------------------------------------------------------------
 */

/**
 * Alterna a exibição do menu de navegação mobile (hambúrguer),
 * adicionando/removendo a classe "open" no elemento #navMenu.
 */
function toggleMenu() {
  const menu = document.getElementById('navMenu');
  if (menu) menu.classList.toggle('open');
}

/**
 * Substitui a thumbnail estática do vídeo principal por um iframe do
 * YouTube com autoplay, ao ser clicado. Feito sob demanda (em vez de
 * embutir o iframe direto no HTML) para não carregar o player do
 * YouTube — e seus scripts — antes que o usuário realmente queira
 * assistir, melhorando o tempo de carregamento inicial da página.
 *
 * @param {HTMLElement} el - contêiner que exibia a thumbnail
 */
function openMainVideo(el) {
  if (!el) return;

  el.innerHTML = `
    <iframe 
      src="https://www.youtube.com/embed/5Lb6Rh8ZqQ4?autoplay=1"
      style="width:100%;height:500px;border:none;display:block;"
      allowfullscreen>
    </iframe>
  `;
}

/**
 * Abre/fecha um item do accordion de FAQ, fechando qualquer outro item
 * que já estivesse aberto (comportamento "sanfona": apenas uma
 * resposta visível por vez).
 *
 * A altura da resposta é animada via max-height calculado dinamicamente
 * (scrollHeight), já que CSS puro não anima de "altura automática" para
 * um valor fixo sem conhecer a altura real do conteúdo.
 *
 * @param {HTMLElement} btn - botão da pergunta que foi clicado
 */
function toggleFaq(btn) {
  if (!btn) return;

  const item = btn.parentElement;
  if (!item) return;

  const answer = item.querySelector('.faq-answer');
  const isOpen = item.classList.contains('open');

  document.querySelectorAll('.faq-item.open').forEach(other => {
    if (other !== item) {
      other.classList.remove('open');
      const ans = other.querySelector('.faq-answer');
      if (ans) ans.style.maxHeight = null;
    }
  });

  if (!answer) return;

  if (isOpen) {
    item.classList.remove('open');
    answer.style.maxHeight = null;
  } else {
    item.classList.add('open');
    answer.style.maxHeight = answer.scrollHeight + 'px';
  }
}

/* =========================
   CAROUSEL
   ------------------------------------------------------------------
   Carrossel simples baseado em transform: translateX, sem depender de
   nenhuma biblioteca externa. O estado (slide atual e referências de
   DOM) fica em variáveis de módulo porque é compartilhado entre as
   funções de navegação (moveCarousel, goToSlide) e o listener de
   resize da janela.
========================= */
let carouselIndex = 0;
let carouselSlides = [];
let carouselTrackEl = null;
let carouselDotsEl = null;

/**
 * Recalcula e aplica o deslocamento horizontal (transform) necessário
 * para exibir o slide atual (carouselIndex), considerando a largura
 * real de cada slide e o gap entre eles (lido do CSS computado, para
 * funcionar em qualquer breakpoint responsivo sem valores fixos).
 * Também sincroniza qual "bolinha" de navegação aparece ativa.
 */
function updateCarousel() {
  if (!carouselTrackEl || carouselSlides.length === 0) return;

  const slideWidth = carouselSlides[0].getBoundingClientRect().width;
  const gap = parseFloat(getComputedStyle(carouselTrackEl).gap) || 0;

  carouselTrackEl.style.transform = `translateX(-${carouselIndex * (slideWidth + gap)}px)`;

  if (carouselDotsEl) {
    carouselDotsEl.querySelectorAll('.carousel-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === carouselIndex);
    });
  }
}

/**
 * Avança ou retrocede o carrossel, voltando ao início/fim de forma
 * circular (looping) quando o limite é ultrapassado em qualquer direção.
 *
 * @param {number} direction - 1 para avançar, -1 para retroceder
 */
function moveCarousel(direction) {
  if (carouselSlides.length === 0) return;

  carouselIndex += direction;
  if (carouselIndex < 0) carouselIndex = carouselSlides.length - 1;
  if (carouselIndex >= carouselSlides.length) carouselIndex = 0;

  updateCarousel();
}

/**
 * Navega diretamente para um slide específico (usado pelos cliques
 * nas "bolinhas" de navegação do carrossel).
 *
 * @param {number} index - índice do slide de destino
 */
function goToSlide(index) {
  carouselIndex = index;
  updateCarousel();
}

// Todo o restante do script só é executado após o DOM estar pronto,
// garantindo que os elementos consultados via getElementById/querySelector
// já existam na página.
document.addEventListener('DOMContentLoaded', () => {

  // Adiciona sombra/fundo ao header assim que a página é rolada além de
  // 40px, dando um efeito de header "flutuante" sobre o conteúdo.
  window.addEventListener('scroll', () => {
    const header = document.getElementById('siteHeader');
    if (header) {
      header.classList.toggle('scrolled', window.scrollY > 40);
    }
  });

  /* =========================
     REVEAL ANIMATION
     ------------------------------------------------------------------
     Anima a entrada (fade/slide, via CSS na classe "visible") de
     qualquer elemento marcado com a classe "reveal" assim que ele entra
     na viewport. Usa IntersectionObserver em vez de listener de scroll
     por ser mais performático (não recalcula em todo frame de rolagem).
     Cada elemento é observado apenas uma vez (unobserve após animar),
     e o atraso escalonado (i % 4 * 0.1s) cria um efeito de cascata para
     elementos que aparecem em grupo.
  ========================= */
  const revealEls = document.querySelectorAll('.reveal');

  if (revealEls.length > 0) {
    const revealObs = new IntersectionObserver(entries => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          e.target.style.transitionDelay = (i % 4) * 0.1 + 's';
          e.target.classList.add('visible');
          revealObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });

    revealEls.forEach(el => revealObs.observe(el));
  }

  /* =========================
     COUNT ANIMATION
     ------------------------------------------------------------------
     Anima os números de estatísticas (ex.: "+500 alunos") contando de
     0 até o valor definido em data-target, disparado apenas quando o
     elemento entra na tela. Números >= 1000 recebem separador de milhar
     no formato brasileiro (ex.: "1.200").
  ========================= */
  const countEls = document.querySelectorAll('.stat-number[data-target]');

  if (countEls.length > 0) {
    const countObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const el = e.target;
          const target = parseInt(el.getAttribute('data-target'));
          if (!target) return;

          let current = 0;
          const step = target / 60;

          const timer = setInterval(() => {
            current += step;

            if (current >= target) {
              current = target;
              clearInterval(timer);
            }

            const isThousands = target >= 1000;

            el.textContent = isThousands
              ? '+' + Math.floor(current).toLocaleString('pt-BR')
              : '+' + Math.floor(current);

          }, 25);

          countObs.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    countEls.forEach(el => countObs.observe(el));
  }

  /* =========================
     CAROUSEL INIT
     ------------------------------------------------------------------
     Localiza o carrossel no DOM, coleta seus slides e gera dinamicamente
     uma "bolinha" de navegação para cada slide (em vez de fixar no HTML,
     evitando dessincronia caso o número de slides mude no futuro).
  ========================= */
  carouselTrackEl = document.getElementById('carousel');
  carouselDotsEl = document.getElementById('carouselDots');

  if (carouselTrackEl) {
    carouselSlides = Array.from(carouselTrackEl.querySelectorAll('.carousel-slide'));

    if (carouselDotsEl && carouselSlides.length > 0) {
      carouselSlides.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
        dot.type = 'button';
        dot.setAttribute('aria-label', 'Ir para slide ' + (i + 1));
        dot.addEventListener('click', () => goToSlide(i));
        carouselDotsEl.appendChild(dot);
      });
    }

    updateCarousel();
    window.addEventListener('resize', updateCarousel);
  }

  /* =========================
     CONTACT BUTTON
     ------------------------------------------------------------------
     Formulário de contato "sem backend": em vez de enviar os dados a um
     servidor, monta uma mensagem de texto formatada e abre o WhatsApp
     Web/App já com a conversa e mensagem preenchidas (wa.me), simples
     e sem custo de infraestrutura de e-mail/SMTP para esse formulário.
  ========================= */
  const btnForm = document.querySelector('.btn-form');

  if (btnForm) {
    btnForm.addEventListener('click', function () {
      const nameInput = document.querySelector('.contact-right input[type="text"]');
      const phoneInput = document.querySelector('.contact-right input[type="tel"]');
      const selectInput = document.querySelector('.contact-right select');
      const textareaInput = document.querySelector('.contact-right textarea');

      const name = nameInput?.value?.trim() || '';
      const phone = phoneInput?.value?.trim() || '';
      const interest = selectInput?.value || '';
      const message = textareaInput?.value?.trim() || '';

      // Validação mínima: nome e WhatsApp são obrigatórios para que a
      // mensagem faça sentido do outro lado; interesse e mensagem livre
      // são opcionais. Feedback visual temporário no próprio botão, sem
      // necessidade de um elemento de erro separado no HTML.
      if (!name || !phone) {
        this.textContent = 'PREENCHA NOME E WHATSAPP';
        this.style.background = '#e74c3c';

        setTimeout(() => {
          this.textContent = 'ENVIAR MENSAGEM';
          this.style.background = '';
        }, 2500);
        return;
      }

      const waMessage = `Olá! Meu nome é ${name}.\nTelefone: ${phone}\nInteresse: ${interest}\nMensagem: ${message}`;
      const waUrl = `https://wa.me/5544998381478?text=${encodeURIComponent(waMessage)}`;

      this.textContent = '✓ REDIRECIONANDO...';
      this.style.background = '#25d366';

      // Pequeno atraso apenas para o usuário perceber o feedback visual
      // (botão verde "redirecionando") antes de abrir a nova aba.
      setTimeout(() => {
        window.open(waUrl, '_blank');
        this.textContent = 'ENVIAR MENSAGEM';
        this.style.background = '';
      }, 500);
    });
  }

  /* =========================
     RIPPLE EFFECT
     ------------------------------------------------------------------
     Efeito visual de "onda" (Material Design-like) ao clicar em botões:
     cria um <span> circular posicionado no ponto exato do clique, cujo
     crescimento/fade é feito via CSS (classe .ripple). Remove qualquer
     ripple anterior do mesmo botão antes de criar um novo, evitando
     sobreposição em cliques rápidos e sucessivos.
  ========================= */
  function addRipple(e) {
    const btn = e.currentTarget;
    if (!btn) return;

    const circle = document.createElement('span');
    const diameter = Math.max(btn.clientWidth, btn.clientHeight);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = diameter + 'px';
    circle.style.left = (e.clientX - btn.offsetLeft - radius) + 'px';
    circle.style.top = (e.clientY - btn.offsetTop - radius) + 'px';
    circle.classList.add('ripple');

    const ripple = btn.querySelector('.ripple');
    if (ripple) ripple.remove();

    btn.appendChild(circle);
  }

  const rippleBtns = document.querySelectorAll(
    '.btn-primary, .btn-ghost, .btn-plan, .header-cta, .header-login-btn, .btn-form'
  );

  rippleBtns.forEach(btn => {
    btn.addEventListener('click', addRipple);
  });


  /* =========================
     MOBILE MENU
  ========================= */
  const mobileToggle = document.getElementById('mobileToggle');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', toggleMenu);
  }

  /* =========================
     CAROUSEL BUTTONS
  ========================= */
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  if (prevBtn) prevBtn.addEventListener('click', () => moveCarousel(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => moveCarousel(1));

  /* =========================
     VIDEO CONTAINER
  ========================= */
  const videoContainer = document.getElementById('mainVideoContainer');
  if (videoContainer) {
    videoContainer.addEventListener('click', () => openMainVideo(videoContainer));
  }

  /* =========================
     FAQ BUTTONS
  ========================= */
  document.querySelectorAll('.faq-question[data-faq-toggle]').forEach(btn => {
    btn.addEventListener('click', () => toggleFaq(btn));
  });

  /* =========================
     DYNAMIC COPYRIGHT YEAR
     ------------------------------------------------------------------
     Preenche o ano atual no rodapé automaticamente, evitando a
     necessidade de atualizar manualmente o HTML a cada virada de ano.
  ========================= */
  const footerYear = document.getElementById('footerYear');
  if (footerYear) {
    footerYear.textContent = new Date().getFullYear();
  }

});
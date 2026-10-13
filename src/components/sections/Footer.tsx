export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__top">
        <div>
          <p className="footer__brand">Чудеса</p>
          <p className="footer__tag">Маркетинг × Разработка × ИИ</p>
        </div>
        <ul className="footer__links">
          <li><a href="#">Telegram</a></li>
          <li><a href="#">VK</a></li>
          <li><a href="mailto:hello@example.ru">hello@example.ru</a></li>
          <li><a href="tel:+70000000000">+7 (000) 000-00-00</a></li>
        </ul>
      </div>
      <div className="footer__word" aria-hidden>
        Чудеса<span>✦</span>
      </div>
      <div className="footer__bottom">
        <span>ИП/ООО «[название]», ИНН [0000000000]</span>
        <a href="#">Политика конфиденциальности</a>
        <span>© 2026</span>
      </div>
    </footer>
  );
}

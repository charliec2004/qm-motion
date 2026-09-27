import React from 'react';
import Link from './Link.jsx';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <p className="site-footer__brand">TRAILHEAD</p>
        <nav aria-label="Footer">
          <ul className="footer-nav">
            <li><Link href="/">Shop</Link></li>
            <li><a href="https://trailhead.example/contact">Contact us</a></li>
          </ul>
        </nav>
        <p className="site-footer__legal">© Trailhead Outfitters</p>
      </div>
    </footer>
  );
}

import React from 'react';
import Link from './Link.jsx';
import { products } from '../data/products.js';

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link className="wordmark" href="/" aria-label="Trailhead home">TRAILHEAD</Link>
        <nav aria-label="Primary">
          <ul className="site-nav">
            {products.map(product => (
              <li key={product.slug}><Link href={`/products/${product.slug}`}>{product.category}</Link></li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

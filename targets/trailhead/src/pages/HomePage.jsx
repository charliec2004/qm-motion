import React from 'react';
import Link from '../components/Link.jsx';
import { products } from '../data/products.js';
import '../styles/home.css';

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <p className="eyebrow">New season</p>
          <h1>Gear for the long way round.</h1>
          <p className="hero__lede">Packs, shells and shelters built to be carried, used hard, and repaired.</p>
          <Link className="button" href="/products/ridgeline-40-pack">Shop the Ridgeline 40</Link>
        </div>
      </section>
      <section className="container featured" aria-labelledby="featured-heading">
        <h2 id="featured-heading">Featured gear</h2>
        <ul className="product-grid">
          {products.map(product => (
            <li key={product.slug} className="product-card">
              <div className={`swatch swatch--${product.tone}`} aria-hidden="true" />
              <p className="product-card__category">{product.category}</p>
              <h3><Link href={`/products/${product.slug}`}>{product.name}</Link></h3>
              <p className="product-card__summary">{product.summary}</p>
              <p className="product-card__price">{product.price}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

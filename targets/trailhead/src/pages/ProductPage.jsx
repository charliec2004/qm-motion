import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { findProduct } from '../data/products.js';
import NotFoundPage from './NotFoundPage.jsx';
import '../styles/product.css';

export default function ProductPage({ slug }) {
  const product = findProduct(slug);
  if (!product) return <NotFoundPage />;
  return (
    <div className="container product">
      <div className={`product__image swatch swatch--${product.tone}`} role="img" aria-label={`${product.name} product photo placeholder`} />
      <div className="product__info">
        <p className="eyebrow">{product.category}</p>
        <h1>{product.name}</h1>
        <p className="product__price">{product.price}</p>
        <p>{product.summary}</p>
        <button className="button" type="button">Add to cart</button>
        <Tabs.Root className="product-tabs" defaultValue="details">
          <Tabs.List className="product-tabs__list" aria-label="Product information">
            <Tabs.Trigger className="product-tabs__trigger" value="details">Details</Tabs.Trigger>
            <Tabs.Trigger className="product-tabs__trigger" value="specs">Specs</Tabs.Trigger>
            <Tabs.Trigger className="product-tabs__trigger" value="care">Care</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content className="product-tabs__panel" value="details"><p>{product.details}</p></Tabs.Content>
          <Tabs.Content className="product-tabs__panel" value="specs">
            <dl className="spec-list">
              {product.specs.map(([term, value]) => (
                <div key={term}><dt>{term}</dt><dd>{value}</dd></div>
              ))}
            </dl>
          </Tabs.Content>
          <Tabs.Content className="product-tabs__panel" value="care"><p>{product.care}</p></Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}

import React from 'react';
import SiteHeader from './components/SiteHeader.jsx';
import SiteFooter from './components/SiteFooter.jsx';
import { usePath } from './components/Link.jsx';
import HomePage from './pages/HomePage.jsx';
import ProductPage from './pages/ProductPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

function route(path) {
  if (path === '/') return <HomePage />;
  const product = path.match(/^\/products\/([a-z0-9-]+)\/?$/);
  if (product) return <ProductPage slug={product[1]} />;
  return <NotFoundPage />;
}

export default function App() {
  const path = usePath();
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <SiteHeader />
      <main id="main" tabIndex={-1}>{route(path)}</main>
      <SiteFooter />
    </>
  );
}

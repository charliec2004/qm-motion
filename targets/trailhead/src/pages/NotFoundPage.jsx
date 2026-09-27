import React from 'react';
import Link from '../components/Link.jsx';

export default function NotFoundPage() {
  return (
    <div className="container not-found">
      <h1>We couldn’t find that page.</h1>
      <p><Link href="/">Back to the shop</Link></p>
    </div>
  );
}

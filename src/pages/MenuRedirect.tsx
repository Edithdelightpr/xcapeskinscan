import { Navigate, useLocation } from 'react-router-dom';

/**
 * Back-compat redirect for the legacy /menu route. If the visitor was
 * heading to the products tab we now send them to /tropixa; everything else
 * lands on /treatments. Query string (e.g. ?ref=) is preserved.
 */
const MenuRedirect = () => {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const isProducts = params.get('tab') === 'products';
  params.delete('tab');
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : '';
  return <Navigate to={`${isProducts ? '/tropixa' : '/treatments'}${suffix}`} replace />;
};

export default MenuRedirect;
const fs = require('fs');
const filePath = 'src/app/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `  const handleLogout = () => {
    try {
      localStorage.removeItem('imagen_salud_session');
    } catch (e) {}
    setIsAuthenticated(false);
    setActiveSection('facturacion');
  };`;

const replacementStr = `  const handleLogout = () => {
    try {
      localStorage.removeItem('imagen_salud_session');
    } catch (e) {}
    setIsAuthenticated(false);
    setActiveSection('facturacion');
  };

  // Guard Estricto de RBAC para navegacin segura
  useEffect(() => {
    if (role === 'cajero') {
      const cajeroAllowed = ['facturacion', 'caja', 'kanban'];
      if (!cajeroAllowed.includes(activeSection)) {
        setActiveSection('facturacion');
      }
    } else if (role === 'asistente') {
      const asistenteForbidden = ['tesoreria', 'ingresos-extra', 'egresos', 'divisas', 'honorarios', 'cierre', 'admin'];
      if (asistenteForbidden.includes(activeSection)) {
        setActiveSection('facturacion');
      }
    }
  }, [role, activeSection]);`;

if (content.includes('handleLogout')) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('src/app/page.tsx patched with RBAC guard');
} else {
  console.log('handleLogout not found');
}

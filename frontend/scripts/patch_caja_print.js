const fs = require('fs');
const filePath = 'src/components/ModuloCajaDiaria.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const target = `              <Button 
                onClick={() => window.print()} 
                className="flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir Ticket</span>
              </Button>`;

const replacement = `              <Button 
                onClick={() => {
                  navigator.clipboard.writeText(
                    'COMPROBANTE DIGITAL IMAGEN SALUD\\n' +
                    'Turno #' + (facturaSeleccionada.turno_num || facturaSeleccionada.id) + '\\n' +
                    'Paciente: ' + facturaSeleccionada.nombre_paciente + '\\n' +
                    'Estudio: ' + facturaSeleccionada.estudio + '\\n' +
                    'Total: $' + Number(facturaSeleccionada.precio_usd || 0).toFixed(2)
                  );
                  alert('Comprobante digital copiado al portapapeles. Impresión física en papel desactivada según política de caja.');
                }} 
                className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs flex items-center justify-center gap-1.5"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Copiar Comprobante Digital</span>
              </Button>`;

if (content.includes('window.print()')) {
  content = content.replace(target, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('ModuloCajaDiaria.tsx window.print replaced successfully');
} else {
  console.log('window.print not found or already replaced');
}

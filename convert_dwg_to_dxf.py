import os
import sys
import subprocess
import glob
import shutil

def find_oda_converter():
    """Busca el ejecutable de ODA File Converter en las rutas de instalación estándar de Windows."""
    search_paths = [
        r"C:\Program Files\ODA",
        r"C:\Program Files (x86)\ODA"
    ]
    for path in search_paths:
        if os.path.exists(path):
            # Buscar recursivamente el archivo exe
            for root, dirs, files in os.walk(path):
                for file in files:
                    if file.lower() == "odafileconverter.exe":
                        return os.path.join(root, file)
    return None

def convert_dwgs_to_dxfs(input_dir, output_dir=None):
    """Convierte todos los archivos .dwg de un directorio a .dxf usando ODA File Converter."""
    if not output_dir:
        output_dir = input_dir

    oda_path = find_oda_converter()
    if not oda_path:
        print("\n[❌ ERROR] No se encontró ODA File Converter en tu sistema.")
        print("Para realizar conversiones de DWG a DXF automáticamente:")
        print("1. Descarga el instalador gratuito de ODA File Converter desde:")
        print("   https://www.opendesign.com/guestfiles/oda_file_converter")
        print("2. Instálalo con las opciones predeterminadas e inicia este script de nuevo.\n")
        return False

    # Contar archivos DWG
    dwg_files = glob.glob(os.path.join(input_dir, "*.dwg"))
    if not dwg_files:
        print(f"\n[⚠️ ALERTA] No se encontraron archivos .dwg en la carpeta: {input_dir}\n")
        return False

    print(f"\n[🔄 PROCESANDO] Encontrados {len(dwg_files)} archivos .dwg para convertir...")
    print(f"Uso de ODA File Converter detectado en: {oda_path}")

    # ODA File Converter Command Line Syntax:
    # ODAFileConverter.exe [Input Folder] [Output Folder] [Version] [Format] [Recurse] [Audit]
    # Ejemplo: ODAFileConverter.exe "C:\input" "C:\output" "ACAD2018" "DXF" "0" "1"
    
    # Crear carpeta temporal si el input y output son iguales para evitar sobreescritura conflictiva
    temp_in = os.path.join(input_dir, "_dwg_temp_in")
    temp_out = os.path.join(input_dir, "_dwg_temp_out")
    
    os.makedirs(temp_in, exist_ok=True)
    os.makedirs(temp_out, exist_ok=True)
    
    try:
        # Copiar solo archivos DWG a la carpeta temporal de entrada
        for f in dwg_files:
            shutil.copy(f, temp_in)
            
        print("Iniciando conversión por lotes en segundo plano...")
        
        # Ejecutar conversión
        # Parámetros: Carpeta Entrada, Carpeta Salida, Versión AutoCAD (2018), Formato (DXF), Recursivo (0), Auditar (1)
        args = [oda_path, temp_in, temp_out, "ACAD2018", "DXF", "0", "1"]
        
        # Ejecutar comando de forma oculta/silenciosa
        subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Mover los archivos DXF convertidos al directorio de salida final
        dxf_converted = glob.glob(os.path.join(temp_out, "*.dxf"))
        for dxf in dxf_converted:
            dest_file = os.path.join(output_dir, os.path.basename(dxf))
            if os.path.exists(dest_file):
                os.remove(dest_file)
            shutil.move(dxf, output_dir)
            print(f"  ✅ Convertido con éxito: {os.path.basename(dxf)}")
            
        print(f"\n[🎉 COMPLETADO] Conversión finalizada. Archivos .dxf guardados en: {output_dir}\n")
        return True
        
    except Exception as e:
        print(f"\n[❌ ERROR] Ocurrió un fallo durante la conversión: {e}\n")
        return False
        
    finally:
        # Limpiar carpetas temporales
        if os.path.exists(temp_in):
            shutil.rmtree(temp_in)
        if os.path.exists(temp_out):
            shutil.rmtree(temp_out)

if __name__ == "__main__":
    # Si se pasa un argumento, lo toma como el directorio de los planos
    dir_to_convert = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
    convert_dwgs_to_dxfs(dir_to_convert)

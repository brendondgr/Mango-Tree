import os
import sys
import subprocess
import time

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    web_dir = os.path.join(root_dir, "web")

    print("=== Starting Mango Tree Development Servers ===")

    # Determine command formats based on OS
    if sys.platform == "win32":
        # On Windows, use cmd.exe to launch commands so it respects paths and execution policies
        django_cmd = ["uv", "run", "manage.py", "runserver", "32553"]
        node_cmd = ["cmd.exe", "/c", "npm", "run", "dev"]
    else:
        django_cmd = ["uv", "run", "manage.py", "runserver", "32553"]
        node_cmd = ["npm", "run", "dev"]

    processes = []
    try:
        # 1. Start Django backend
        print(f"Starting Django backend on port 32553...")
        django_proc = subprocess.Popen(
            django_cmd,
            cwd=root_dir,
            stdout=None,  # Inherit stdout so user sees log stream directly
            stderr=None
        )
        processes.append(django_proc)

        # Give Django a moment to initialize ports
        time.sleep(1.5)

        # 2. Start Vite frontend
        print(f"Starting Vite frontend (dev server)...")
        node_proc = subprocess.Popen(
            node_cmd,
            cwd=web_dir,
            stdout=None,
            stderr=None
        )
        processes.append(node_proc)

        print("\n" + "=" * 60)
        print("Both servers started successfully!")
        print("")
        print("  >> Open the app in your browser at:")
        print("        http://localhost:5173/")
        print("")
        print("  (Django API backend runs on http://localhost:32553/ —")
        print("   that port serves /api only and returns 404 at the root.)")
        print("=" * 60)
        print("\nPress Ctrl+C to terminate both servers.\n")

        # Monitor the processes
        while True:
            for p in processes:
                if p.poll() is not None:
                    # One of the processes exited
                    print(f"\n[Warning] One of the servers terminated early (Exit code: {p.returncode}). Exiting...")
                    return
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n\nStopping servers gracefully...")
    finally:
        # Clean up subprocesses
        for p in processes:
            if p.poll() is None:
                print(f"Terminating subprocess (PID: {p.pid})...")
                p.terminate()
                try:
                    p.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    print(f"Subprocess (PID: {p.pid}) did not exit, force-killing...")
                    p.kill()
        print("Goodbye!")

if __name__ == "__main__":
    main()

import socket
import time


def main():
    target_ip = "192.168.1.116"
    target_port = 443
    count = 30
    delay = 0.05

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        for _ in range(count):
            sock.sendto(b"ping", (target_ip, target_port))
            time.sleep(delay)
    finally:
        sock.close()


if __name__ == "__main__":
    main()

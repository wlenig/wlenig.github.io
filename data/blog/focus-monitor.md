---
title: "Monitoring Focus: A Slice of the Windows API"
publishDate: 2025-01-09T00:00:00-05:00
---

> **Note**: This blog post is incomplete, and also acts as a formatting test. So long as this message is here, the post is incomplete!

I long dreaded upgrading to Windows 11, but when I got a latest-generation AMD processor this past summer, it become all but required to fully utilize the modern hardware. I am happy to repor that after a few settings and registry tweaks, the Windows 11 experience surpasses that of its predecessor...

Until a week ago. With seemingly no change to hardware or software configuration, window focus began to spontaneously break: keyboard and mouse inputs would be sent to the desktop, Explorer would become unresponsive, and, with any luck, a single process, like Chrome, would become the only one interactable. Interestingly, locking and unlocking the Desktop (<kbd>Win</kbd> + <kbd>L</kbd>) would fix the problem, although never for more than a few minutes.

After some quick googling, the issue seemed to be common among Windows 11 users. And, even better, someone had already made a [tool](https://github.com/MoAlyousef/focusmon) to log changes in focus! Upon reviewing it, though, I was dissapointed to see it worked by constantly polling `GetForegroundWindow`, a method which is both resource intensive and also possibly error prone; focus switches that happen faster than the polling interval, for example, can not be reliably detected.

My first thought was to use `SetWindowsHookEx`, installing a hook to `WndProc`, the function that processes messages sent to a window. Upon reviewing MSDN, I was pleased to discover there is instead a hook for "computer-based training" applications, a politically correct term for student monitoring software. This hook, `WH_CBT`, is called whenever a window is created, destroyed, activated, or deactivated, and is perfect for monitoring focus changes.

Using `SetWindowsHookEx` is rather precarious, as it maps the hooking DLL into the address space of every process in the system, a behavior neither anti-viruses or anti-cheats are fond of. Additionally, the callback itself will be called in the context of the process that triggered the hook, so some inter-process communication mechanism will be required to log anything. Nevertheless, I decided to give it a shot, using a named pipe to communicate.

The basic control flow of the program should then be:
1. Create a named pipe instance
2. Install the hook (only once!)
3. Accept a client, read the message, close the connection and log it
4. Repeat from step 1

In C++, this looks like:

```cpp
while (true) {
    auto pipe = create_instance();
    static auto hook = install_hook();
    accept_client(pipe)
}
```

First, we create a named pipe instance. We specify the flags `PIPE_TYPE_MESSAGE` and `PIPE_READMODE_MESSAGE` to ensure that messages are read atomically, and `PIPE_WAIT` to block the server until a client connects.

```cpp
auto create_instance() -> HANDLE
{
    auto instance = CreateNamedPipe(
        monitor::PIPE_NAME,
        PIPE_ACCESS_DUPLEX,
        PIPE_TYPE_MESSAGE | PIPE_READMODE_MESSAGE | PIPE_WAIT,
        PIPE_UNLIMITED_INSTANCES,
        monitor::BUFSIZE,
        monitor::BUFSIZE,
        0,
        NULL
    );

    if (instance == INVALID_HANDLE_VALUE) {
        throw std::runtime_error("Failed to create named pipe");
    }

    return instance;
}
```

To install the hook, we first need to load the DLL into memory. Then, we get the exported callback function, and install it using `SetWindowsHookEx`, specifying the hook ID as `WH_CBT`.

```cpp
auto install_hook() -> HHOOK
{
    auto monitor_module = LoadLibrary(L"monitor.dll");
    if (monitor_module == NULL) {
        throw std::runtime_error("Failed to load monitor module");
    }

    auto cbt_proc = (HOOKPROC)GetProcAddress(monitor_module, "CBTProc");
    if (!cbt_proc) {
        throw std::runtime_error("Failed to find callback function");
    }

    return SetWindowsHookEx(WH_CBT, cbt_proc, monitor_module, 0);
}
```

Accepting a client is straightforward: we wait for a connection, spawn a thread to read and log the message, and close the connection. Interestingly, `ConnectNamedPipe`, the function that waits for a client to connect, returns false in cases where the connection was succesful but the client was waiting. Thankfully, `GetLastError` will return `ERROR_PIPE_CONNECTED` in this case, indiating all is well.

```cpp
auto accept_client(HANDLE instance) -> void
{
    auto connected = ConnectNamedPipe(instance, NULL)
        ? TRUE
        : (GetLastError() == ERROR_PIPE_CONNECTED);
    
    if (!connected) {
        throw std::runtime_error("Failed to connect to named pipe");
    }
    
    DWORD thread_id;
    auto thread = CreateThread(
        NULL,
        0,
        handle_instance,
        instance,
        NULL,
        &thread_id
    );

    if (thread == NULL) {
        throw std::runtime_error("Failed to create thread");
    }

    CloseHandle(thread);
}
```

The thread function is simple: read the message, log it, and close the connection. Because we are using Windows' `CreateThread`, the function must adhere to the `LPTHRAD_START_ROUTINE` signature, which includes returning a `DWORD` and using the `WINAPI` (`__stdcall`) calling convention.

```cpp
auto WINAPI handle_instance(HANDLE instance) -> DWORD
{
    auto event = monitor::FocusEvent{};
    DWORD read;
    
    while (true) {
        if (ReadFile(
            instance,
            &event,
            sizeof(event),
            &read,
            NULL
        )) {
            log_focus_event(event);
        } else {
            break;
        }
    }

    CloseHandle(instance);
    return 0;
}
```

You may observe we are reading a `FocusEvent`, which is defined as follows:

```cpp
struct FocusEvent {
    char executable[MAX_PATH];
    char window_name[MAX_PATH];
    DWORD process_id;
};
```

Moving over to the DLL, or client side, the callback function needs to be defined and exported. Inside it, we check if the hook code is `HCBT_SETFOCUS`, which indicates a window has gained focus, then write the event to the named pipe.

```cpp
extern "C" __declspec(dllexport) LRESULT CALLBACK CBTProc(
  int    nCode,
  WPARAM wParam,
  LPARAM lParam
) {
    // wParam is handle to window gaining focus
    // lParam is handle to window losing focus

    if (nCode == HCBT_SETFOCUS) {
        write_event((HWND)wParam);
    }

    return CallNextHookEx(NULL, nCode, wParam, lParam);
}
```

This is where I am stopping for now, since I have to go to class. To be continued
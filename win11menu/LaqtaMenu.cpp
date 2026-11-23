// Windows 11 top-level right-click menu for Laqta (IExplorerCommand COM handler).
// Loaded by Explorer through the package in ..\AppxManifest.xml. Each item launches
// "<root>\node_modules\electron\dist\electron.exe" "<root>" --action=<x>.
#include <windows.h>
#include <shobjidl_core.h>
#include <shlwapi.h>
#include <string>
#include <new>
#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "shell32.lib")

// {D1F0A1B2-7C3E-4F5A-9B8C-1A2B3C4D5E6F} — must match AppxManifest.xml
static const CLSID CLSID_LaqtaMenu = { 0xd1f0a1b2, 0x7c3e, 0x4f5a, { 0x9b, 0x8c, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e, 0x6f } };
static HMODULE g_module = nullptr;
static long g_objects = 0;

struct Item { const wchar_t* ar; const wchar_t* en; const wchar_t* action; };
static const Item kItems[] = {
  { L"لقطة للشاشة كاملة", L"Full-screen screenshot", L"full" },
  { L"لقطة لمنطقة", L"Region screenshot", L"region" },
  { L"تسجيل الشاشة", L"Screen Record", L"screen" },
  { L"الكاميرا فقط", L"Camera Only", L"camera" },
  { L"تسجيل صوت فقط", L"Audio Only", L"audio" },
  { L"فتح البرنامج", L"Open app", L"open" },
};
static const ULONG kCount = ARRAYSIZE(kItems);

// dll lives in <root>\win11menu\LaqtaMenu.dll
static std::wstring AppRoot() {
  wchar_t p[MAX_PATH] = {};
  GetModuleFileNameW(g_module, p, MAX_PATH);
  PathRemoveFileSpecW(p); PathRemoveFileSpecW(p);
  return p;
}
static std::wstring ElectronExe() { return AppRoot() + L"\\node_modules\\electron\\dist\\electron.exe"; }

// follow the app's language setting (%APPDATA%\laqta\settings.json)
static bool English() {
  wchar_t appdata[MAX_PATH];
  if (!GetEnvironmentVariableW(L"APPDATA", appdata, MAX_PATH)) return false;
  std::wstring f = std::wstring(appdata) + L"\\laqta\\settings.json";
  HANDLE h = CreateFileW(f.c_str(), GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_EXISTING, 0, nullptr);
  if (h == INVALID_HANDLE_VALUE) return false;
  char buf[8192] = {}; DWORD n = 0;
  ReadFile(h, buf, sizeof(buf) - 1, &n, nullptr);
  CloseHandle(h);
  return strstr(buf, "\"lang\": \"en\"") != nullptr;
}

// Launch outside the package so the app keeps its normal AppData/settings (no virtualization).
static HRESULT Launch(const wchar_t* action) {
  std::wstring root = AppRoot(), exe = ElectronExe();
  std::wstring cmd = L"\"" + exe + L"\" \"" + root + L"\" --action=" + action;
  SIZE_T size = 0;
  InitializeProcThreadAttributeList(nullptr, 1, 0, &size);
  auto attrs = (LPPROC_THREAD_ATTRIBUTE_LIST)HeapAlloc(GetProcessHeap(), 0, size);
  if (!attrs) return E_OUTOFMEMORY;
  STARTUPINFOEXW si = {}; si.StartupInfo.cb = sizeof(si);
  DWORD policy = PROCESS_CREATION_DESKTOP_APP_BREAKAWAY_OVERRIDE;
  bool ok = InitializeProcThreadAttributeList(attrs, 1, 0, &size) &&
    UpdateProcThreadAttribute(attrs, 0, PROC_THREAD_ATTRIBUTE_DESKTOP_APP_POLICY, &policy, sizeof(policy), nullptr, nullptr);
  si.lpAttributeList = ok ? attrs : nullptr;
  PROCESS_INFORMATION pi = {};
  BOOL created = CreateProcessW(exe.c_str(), &cmd[0], nullptr, nullptr, FALSE,
    ok ? EXTENDED_STARTUPINFO_PRESENT : 0, nullptr, root.c_str(), (LPSTARTUPINFOW)&si, &pi);
  if (ok) DeleteProcThreadAttributeList(attrs);
  HeapFree(GetProcessHeap(), 0, attrs);
  if (!created) return HRESULT_FROM_WIN32(GetLastError());
  CloseHandle(pi.hThread); CloseHandle(pi.hProcess);
  return S_OK;
}

template <class T> class ComBase : public T {
  long refs = 1;
public:
  ComBase() { InterlockedIncrement(&g_objects); }
  virtual ~ComBase() { InterlockedDecrement(&g_objects); }
  IFACEMETHODIMP_(ULONG) AddRef() override { return InterlockedIncrement(&refs); }
  IFACEMETHODIMP_(ULONG) Release() override { long r = InterlockedDecrement(&refs); if (!r) delete this; return r; }
  IFACEMETHODIMP QueryInterface(REFIID riid, void** ppv) override {
    if (!ppv) return E_POINTER;
    if (riid == IID_IUnknown || riid == __uuidof(T)) { *ppv = static_cast<T*>(this); AddRef(); return S_OK; }
    *ppv = nullptr; return E_NOINTERFACE;
  }
};

class Command : public ComBase<IExplorerCommand> {
  int index; // -1 = root "Laqta" entry, otherwise kItems[index]
public:
  explicit Command(int i) : index(i) {}
  IFACEMETHODIMP GetTitle(IShellItemArray*, LPWSTR* name) override {
    if (index < 0) return SHStrDupW(English() ? L"Laqta" : L"لقطة", name);
    return SHStrDupW(English() ? kItems[index].en : kItems[index].ar, name);
  }
  IFACEMETHODIMP GetIcon(IShellItemArray*, LPWSTR* icon) override {
    if (index >= 0) { *icon = nullptr; return E_NOTIMPL; }
    return SHStrDupW((ElectronExe() + L",0").c_str(), icon);
  }
  IFACEMETHODIMP GetToolTip(IShellItemArray*, LPWSTR* tip) override { *tip = nullptr; return E_NOTIMPL; }
  IFACEMETHODIMP GetCanonicalName(GUID* g) override { *g = GUID_NULL; return S_OK; }
  IFACEMETHODIMP GetState(IShellItemArray*, BOOL, EXPCMDSTATE* state) override { *state = ECS_ENABLED; return S_OK; }
  IFACEMETHODIMP Invoke(IShellItemArray*, IBindCtx*) override { return index < 0 ? S_OK : Launch(kItems[index].action); }
  IFACEMETHODIMP GetFlags(EXPCMDFLAGS* flags) override { *flags = index < 0 ? ECF_HASSUBCOMMANDS : ECF_DEFAULT; return S_OK; }
  IFACEMETHODIMP EnumSubCommands(IEnumExplorerCommand** e) override;
};

class Enumerator : public ComBase<IEnumExplorerCommand> {
  ULONG pos = 0;
public:
  IFACEMETHODIMP Next(ULONG celt, IExplorerCommand** out, ULONG* fetched) override {
    ULONG n = 0;
    for (; n < celt && pos < kCount; n++, pos++) {
      out[n] = new (std::nothrow) Command((int)pos);
      if (!out[n]) break;
    }
    if (fetched) *fetched = n;
    return n == celt ? S_OK : S_FALSE;
  }
  IFACEMETHODIMP Skip(ULONG celt) override { pos = min(kCount, pos + celt); return pos < kCount ? S_OK : S_FALSE; }
  IFACEMETHODIMP Reset() override { pos = 0; return S_OK; }
  IFACEMETHODIMP Clone(IEnumExplorerCommand** e) override { *e = nullptr; return E_NOTIMPL; }
};

IFACEMETHODIMP Command::EnumSubCommands(IEnumExplorerCommand** e) {
  if (index >= 0) { *e = nullptr; return E_NOTIMPL; }
  *e = new (std::nothrow) Enumerator();
  return *e ? S_OK : E_OUTOFMEMORY;
}

class Factory : public ComBase<IClassFactory> {
public:
  IFACEMETHODIMP CreateInstance(IUnknown* outer, REFIID riid, void** ppv) override {
    *ppv = nullptr;
    if (outer) return CLASS_E_NOAGGREGATION;
    Command* c = new (std::nothrow) Command(-1);
    if (!c) return E_OUTOFMEMORY;
    HRESULT hr = c->QueryInterface(riid, ppv);
    c->Release();
    return hr;
  }
  IFACEMETHODIMP LockServer(BOOL lock) override { lock ? InterlockedIncrement(&g_objects) : InterlockedDecrement(&g_objects); return S_OK; }
};

BOOL APIENTRY DllMain(HMODULE m, DWORD reason, LPVOID) {
  if (reason == DLL_PROCESS_ATTACH) { g_module = m; DisableThreadLibraryCalls(m); }
  return TRUE;
}
STDAPI DllCanUnloadNow() { return g_objects == 0 ? S_OK : S_FALSE; }
STDAPI DllGetClassObject(REFCLSID clsid, REFIID riid, void** ppv) {
  *ppv = nullptr;
  if (clsid != CLSID_LaqtaMenu) return CLASS_E_CLASSNOTAVAILABLE;
  Factory* f = new (std::nothrow) Factory();
  if (!f) return E_OUTOFMEMORY;
  HRESULT hr = f->QueryInterface(riid, ppv);
  f->Release();
  return hr;
}

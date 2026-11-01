// Windows share target for Grok Bot.
// WeChat hands us StorageItems/Text/URI; the helper copies the files into our
// inbox and asks the running app to pick a Bot. The picker lives in the app,
// so the menu entry stays a single row.
#include <windows.h>
#include <shellapi.h>
#include <shlobj.h>
#include <string>
#include <vector>
#include <fstream>
#include <sstream>

#include <winrt/base.h>
#include <winrt/Windows.ApplicationModel.h>
#include <winrt/Windows.ApplicationModel.Activation.h>
#include <winrt/Windows.ApplicationModel.DataTransfer.h>
#include <winrt/Windows.ApplicationModel.DataTransfer.ShareTarget.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.Storage.h>

#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "WindowsApp.lib")

using namespace winrt;
using namespace Windows::ApplicationModel;
using namespace Windows::ApplicationModel::Activation;
using namespace Windows::ApplicationModel::DataTransfer;
using namespace Windows::Storage;

static std::wstring Utf8ToWide(const std::string& text) {
    if (text.empty()) return std::wstring();
    int size = MultiByteToWideChar(CP_UTF8, 0, text.c_str(), -1, nullptr, 0);
    std::wstring out(size > 0 ? size - 1 : 0, L'\0');
    if (size > 0) MultiByteToWideChar(CP_UTF8, 0, text.c_str(), -1, out.data(), size);
    return out;
}

static std::string WideToUtf8(const std::wstring& text) {
    if (text.empty()) return std::string();
    int size = WideCharToMultiByte(CP_UTF8, 0, text.c_str(), -1, nullptr, 0, nullptr, nullptr);
    std::string out(size > 0 ? size - 1 : 0, '\0');
    if (size > 0) WideCharToMultiByte(CP_UTF8, 0, text.c_str(), -1, out.data(), size, nullptr, nullptr);
    return out;
}

static std::wstring EscapeJson(const std::wstring& text) {
    std::wstring out;
    for (wchar_t c : text) {
        if (c == L'\\') out += L"\\\\";
        else if (c == L'"') out += L"\\\"";
        else if (c == L'\n') out += L"\\n";
        else if (c == L'\r') out += L"\\r";
        else out += c;
    }
    return out;
}

static std::wstring AppDataPath() {
    wchar_t buffer[MAX_PATH * 2] = {};
    DWORD size = GetEnvironmentVariableW(L"APPDATA", buffer, MAX_PATH * 2);
    return size ? std::wstring(buffer) : std::wstring();
}

static void WriteText(const std::wstring& path, const std::string& text) {
    std::ofstream file(path, std::ios::binary | std::ios::trunc);
    if (file) file.write(text.data(), static_cast<std::streamsize>(text.size()));
}

static void LaunchApp(const std::wstring& uri) {
    ShellExecuteW(nullptr, L"open", uri.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
}

static void LogLine(const std::string& line) {
    wchar_t temp[MAX_PATH] = {};
    if (!GetTempPathW(MAX_PATH, temp)) return;
    std::wstring path(temp);
    path += L"grokbot-share-target.log";
    std::ofstream file(path, std::ios::binary | std::ios::app);
    if (file) file << line << "\r\n";
}

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int) {
    try {
        init_apartment(apartment_type::single_threaded);
    } catch (...) {
        return 0;
    }

    try {
        auto activated = AppInstance::GetActivatedEventArgs();
        if (activated.Kind() != ActivationKind::ShareTarget) {
            // Launched directly (for example from the Start menu): just show the app.
            LaunchApp(L"grokbotanywhere://open");
            return 0;
        }

        auto shareArgs = activated.as<ShareTargetActivatedEventArgs>();
        auto operation = shareArgs.ShareOperation();
        auto data = operation.Data();

        GUID guid{};
        CoCreateGuid(&guid);
        wchar_t batchId[40] = {};
        swprintf_s(batchId, L"%08x%04x%04x%02x%02x%02x%02x%02x%02x%02x%02x",
                   guid.Data1, guid.Data2, guid.Data3, guid.Data4[0], guid.Data4[1],
                   guid.Data4[2], guid.Data4[3], guid.Data4[4], guid.Data4[5],
                   guid.Data4[6], guid.Data4[7]);

        std::wstring root = AppDataPath() + L"\\Grok Bot Anywhere\\share-pending\\" + batchId;
        std::wstring rootNative = root;
        CreateDirectoryW((AppDataPath() + L"\\Grok Bot Anywhere").c_str(), nullptr);
        CreateDirectoryW((AppDataPath() + L"\\Grok Bot Anywhere\\share-pending").c_str(), nullptr);
        CreateDirectoryW(rootNative.c_str(), nullptr);

        std::wstring text;
        std::wstring link;
        if (data.Contains(StandardDataFormats::Text())) {
            text = data.GetTextAsync().get().c_str();
        }
        if (data.Contains(StandardDataFormats::WebLink())) {
            auto linkUri = data.GetWebLinkAsync().get();
            link = linkUri.RawUri().c_str();
        }

        std::wstring entries;
        int copied = 0;
        if (data.Contains(StandardDataFormats::StorageItems())) {
            auto items = data.GetStorageItemsAsync().get();
            auto folder = StorageFolder::GetFolderFromPathAsync(rootNative).get();
            for (auto const& item : items) {
                auto file = item.try_as<StorageFile>();
                if (!file) continue;
                auto stored = file.CopyAsync(folder, file.Name(), NameCollisionOption::GenerateUniqueName).get();
                if (!entries.empty()) entries += L",";
                entries += L"{\"name\":\"" + EscapeJson(stored.Name().c_str()) +
                           L"\",\"path\":\"" + EscapeJson(stored.Path().c_str()) + L"\"}";
                copied++;
            }
        }

        std::wstring manifest = L"{\"version\":1,\"batchId\":\"" + std::wstring(batchId) +
            L"\",\"text\":\"" + EscapeJson(text) + L"\",\"link\":\"" + EscapeJson(link) +
            L"\",\"files\":[" + entries + L"]}";
        WriteText(root + L"\\manifest.json", WideToUtf8(manifest));

        LogLine("batch=" + WideToUtf8(std::wstring(batchId)) + " files=" + std::to_string(copied) +
                " text=" + std::to_string(text.size()));

        LaunchApp(L"grokbotanywhere://share?batch=" + std::wstring(batchId));
        operation.ReportCompleted();
        return 0;
    } catch (hresult_error const& error) {
        LogLine("error=" + WideToUtf8(std::wstring(error.message().c_str())));
        return 1;
    } catch (...) {
        LogLine("error=unknown");
        return 1;
    }
}

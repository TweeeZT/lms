"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import * as Blockly from "blockly";
import "blockly/blocks";
import { javascriptGenerator } from "blockly/javascript";
import {
  injectIndonesianScratchBlockly,
  defineIndonesianScratchBlocks,
  INDONESIAN_SCRATCH_TOOLBOX_XML,
} from "@/lib/blocklyIndonesianScratch";
import { useAuth } from "@/hooks/useAuth";
import type { BlocklyProject } from "@/types";
import {
  Button,
  Group,
  Stack,
  Text,
  Loader,
  ActionIcon,
  Paper,
  Divider,
  Tooltip,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconPlayerPlay,
  IconTerminal2,
  IconChevronDown,
  IconChevronUp,
  IconRefresh,
} from "@tabler/icons-react";

const WORKSPACE_ID = "blocklyWorkspace";

export default function BlocklyProjectEditorPage() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const projectId = params?.id;
  const router = useRouter();

  const blocklyDivRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState("");
  const [showOutput, setShowOutput] = useState(true);
  const [workspaceHeight, setWorkspaceHeight] = useState(500);
  const [workspaceXml, setWorkspaceXml] = useState<string | null>(null);

  // Responsive height
  useEffect(() => {
    const calc = () => {
      const header = 120;
      const h = window.innerHeight - header;
      setWorkspaceHeight(Math.max(320, h - (showOutput ? 200 : 0)));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [showOutput]);

  const loadProject = useCallback(async () => {
    if (!user?.id || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/user/blockly-projects?userId=${user.id}&projectId=${projectId}`
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal memuat proyek");
      const p: BlocklyProject | null = json.project;
      if (!p) {
        setError("Proyek tidak ditemukan");
        return;
      }
      setTitle(p.title);
      setDescription(p.description || "");
      setIsPublic(p.is_public);
      setWorkspaceXml(p.workspace_xml || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat proyek");
    } finally {
      setLoading(false);
    }
  }, [user?.id, projectId]);

  useEffect(() => {
    loadProject();
    return () => workspaceRef.current?.dispose();
  }, [loadProject]);

  // Inject Blockly AFTER the workspace div is rendered (i.e., loading false)
  useEffect(() => {
    if (loading) return; // wait for data load to finish so div is in DOM
    if (!blocklyDivRef.current) return; // div not yet mounted
    // (Re)initialize workspace
    defineIndonesianScratchBlocks();
    workspaceRef.current?.dispose();
    workspaceRef.current = injectIndonesianScratchBlockly(WORKSPACE_ID, {
      toolbox: INDONESIAN_SCRATCH_TOOLBOX_XML,
    });
    if (workspaceXml) {
      try {
        const XmlAny = Blockly.Xml as unknown as {
          textToDom: (t: string) => Element;
          domToWorkspace: (dom: Element, ws: Blockly.Workspace) => void;
        };
        const dom = XmlAny.textToDom(workspaceXml);
        XmlAny.domToWorkspace(dom, workspaceRef.current);
      } catch (err) {
        // ignore malformed xml
        console.warn("Gagal memuat XML workspace:", err);
      }
    }
  }, [loading, workspaceXml]);

  const serialize = () => {
    if (!workspaceRef.current) return { xml: "", code: "" };
    const xmlDom = Blockly.Xml.workspaceToDom(workspaceRef.current);
    const xmlText = Blockly.Xml.domToText(xmlDom);
    const code = javascriptGenerator.workspaceToCode(workspaceRef.current);
    return { xml: xmlText, code };
  };

  const saveAll = async () => {
    if (!user?.id || !projectId) return;
    setSaving(true);
    try {
      const { xml, code } = serialize();
      const res = await fetch("/api/user/blockly-projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          userId: user.id,
          title,
          description,
          isPublic,
          workspaceXml: xml,
          codeJs: code,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal simpan");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal simpan");
    } finally {
      setSaving(false);
    }
  };

  const runCode = () => {
    setRunning(true);
    setOutput("");
    try {
      const { code } = serialize();
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        logs.push(
          args
            .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
            .join(" ")
        );
      };
      // Wrap in async IIFE to support await in control blocks
      const full = `(async () => { ${code} })();`;
      new Function(full)();
      console.log = originalLog;
      setOutput(logs.join("\n"));
    } catch (e) {
      setOutput(e instanceof Error ? e.message : "Error menjalankan kode");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Stack p="md" gap="sm" style={{ height: "100%", maxWidth: "100%" }}>
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Group gap="xs" wrap="nowrap">
          <Tooltip label="Kembali ke daftar">
            <ActionIcon
              variant="light"
              onClick={() => router.push("/user/projects")}
              aria-label="kembali"
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
          </Tooltip>
          <Text fw={600} size="lg" style={{ lineHeight: 1.2 }}>
            {title || "Memuat..."}
          </Text>
        </Group>
        <Group gap="xs">
          <Tooltip
            label={showOutput ? "Sembunyikan Output" : "Tampilkan Output"}
          >
            <ActionIcon
              variant="light"
              aria-label="toggle-output"
              onClick={() => setShowOutput((s) => !s)}
            >
              {showOutput ? (
                <IconChevronDown size={18} />
              ) : (
                <IconChevronUp size={18} />
              )}
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Jalankan kode (generate JS & eksekusi)">
            <Button
              leftSection={<IconPlayerPlay size={16} />}
              variant="light"
              onClick={runCode}
              loading={running}
            >
              Jalankan
            </Button>
          </Tooltip>
          <Tooltip label="Simpan proyek (XML + JS)">
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={saveAll}
              loading={saving}
            >
              Simpan
            </Button>
          </Tooltip>
        </Group>
      </Group>
      <Divider my={0} />
      {loading ? (
        <Group justify="center" mt="xl">
          <Loader />
        </Group>
      ) : error ? (
        <Text c="red" size="sm">
          {error}
        </Text>
      ) : (
        <Group align="stretch" gap="sm" style={{ flex: 1, minHeight: 0 }}>
          <Paper
            withBorder
            radius="md"
            p={0}
            style={{
              flex: 1,
              minHeight: 0,
              height: workspaceHeight,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              ref={blocklyDivRef}
              id={WORKSPACE_ID}
              style={{ width: "100%", height: "100%" }}
            />
          </Paper>
          {showOutput && (
            <Paper
              withBorder
              radius="md"
              p="xs"
              style={{
                width: 320,
                maxWidth: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <Group justify="space-between" mb={4} gap={4} wrap="nowrap">
                <Group gap={6}>
                  <IconTerminal2 size={16} />
                  <Text size="sm" fw={600}>
                    Output
                  </Text>
                </Group>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  aria-label="clear-output"
                  onClick={() => setOutput("")}
                >
                  <IconRefresh size={14} />
                </ActionIcon>
              </Group>
              <div
                style={{
                  flex: 1,
                  overflow: "auto",
                  border: "1px solid var(--mantine-color-gray-3, #e1e3e8)",
                  borderRadius: 4,
                  padding: 6,
                  background: "#0e1116",
                  color: "#d1d5db",
                }}
              >
                <pre
                  style={{
                    margin: 0,
                    fontSize: 12,
                    lineHeight: 1.4,
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                  }}
                >
                  {output || "(kosong)"}
                </pre>
              </div>
            </Paper>
          )}
        </Group>
      )}
    </Stack>
  );
}

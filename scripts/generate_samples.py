#!/usr/bin/env python3
"""Generate redistributable DXF samples for 览图.

Drawings are original and released with this repository under GPL-3.0-only.
When `dxf2dwg` from GNU LibreDWG is on PATH, matching DWG files are written too.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import ezdxf
from ezdxf import units
from ezdxf.enums import TextEntityAlignment

ROOT = Path(__file__).resolve().parents[1]
DXF_DIR = ROOT / "public" / "samples" / "dxf"
DWG_DIR = ROOT / "public" / "samples" / "dwg"
TEMPLATE_DIR = ROOT / "public" / "cad-data" / "templates"


def new_doc():
    doc = ezdxf.new("R2010", setup=True, units=units.MM)
    doc.styles.add("CN", font="simsun.ttf")
    return doc


def drop_default_layout(doc: ezdxf.document.Drawing) -> None:
    names = [name for name in doc.layouts.names() if name != "Model"]
    if "Layout1" in names and len(names) > 1:
        doc.layouts.delete("Layout1")


def add_layers(doc: ezdxf.document.Drawing) -> None:
    specs = {
        "墙": 1,
        "轴网": 4,
        "门窗": 3,
        "标注": 2,
        "文字": 7,
        "填充": 8,
        "隐藏": 6,
    }
    for name, color in specs.items():
        if name not in doc.layers:
            doc.layers.add(name, color=color)
    doc.layers.get("隐藏").off()


def add_title(msp, text: str, at: tuple[float, float], height: float = 5) -> None:
    msp.add_text(
        text,
        height=height,
        dxfattribs={"style": "CN", "layer": "文字"},
    ).set_placement(at, align=TextEntityAlignment.LEFT)


def write_measure_fixture(path: Path) -> None:
    doc = new_doc()
    add_layers(doc)
    msp = doc.modelspace()
    msp.add_line((0, 0), (100, 0), dxfattribs={"layer": "墙"})
    msp.add_circle((50, 30), 10, dxfattribs={"layer": "门窗"})
    msp.add_arc(
        (20, 20),
        radius=12,
        start_angle=0,
        end_angle=90,
        dxfattribs={"layer": "门窗"},
    )
    msp.add_lwpolyline(
        [(0, 0), (100, 0), (100, 50)],
        close=True,
        dxfattribs={"layer": "轴网"},
    )
    add_title(msp, "测量基准 100", (0, 62), 4)
    msp.add_line((0, -5), (10, -5), dxfattribs={"layer": "隐藏"})
    doc.saveas(path)


def write_plan(path: Path) -> None:
    doc = new_doc()
    add_layers(doc)
    msp = doc.modelspace()

    # Outer wall, 12 m × 8 m drawn in millimetres.
    wall = [(0, 0), (12000, 0), (12000, 8000), (0, 8000)]
    msp.add_lwpolyline(wall, close=True, dxfattribs={"layer": "墙"})
    msp.add_line((4200, 0), (4200, 8000), dxfattribs={"layer": "墙"})
    msp.add_line((4200, 3600), (12000, 3600), dxfattribs={"layer": "墙"})

    # Axis.
    msp.add_line((-800, 0), (12800, 0), dxfattribs={"layer": "轴网"})
    msp.add_line((0, -800), (0, 8800), dxfattribs={"layer": "轴网"})

    door = doc.blocks.new("门")
    door.add_line((0, 0), (900, 0), dxfattribs={"layer": "门窗"})
    door.add_arc(
        (0, 0),
        radius=900,
        start_angle=0,
        end_angle=90,
        dxfattribs={"layer": "门窗"},
    )
    msp.add_blockref("门", (1800, 0), dxfattribs={"layer": "门窗"})

    hatch = msp.add_hatch(color=8, dxfattribs={"layer": "填充"})
    hatch.paths.add_polyline_path(
        [(4500, 3800), (11800, 3800), (11800, 7800), (4500, 7800)],
        is_closed=True,
    )
    hatch.set_pattern_fill("ANSI31", scale=80)

    dim = msp.add_linear_dim(
        base=(0, -1200),
        p1=(0, 0),
        p2=(12000, 0),
        dimstyle="EZ_MM",
        dxfattribs={"layer": "标注"},
    )
    dim.render()

    add_title(msp, "客厅", (1400, 4200), 350)
    add_title(msp, "卧室", (7000, 5600), 350)
    mtext = msp.add_mtext(
        "览图示例\\P一层平面 · 中文标注",
        dxfattribs={"style": "CN", "layer": "文字", "char_height": 280},
    )
    mtext.set_location((200, 8600))
    msp.add_line((100, 100), (400, 100), dxfattribs={"layer": "隐藏"})

    layout = doc.layouts.new("图框")
    layout.page_setup(size=(420, 297), margins=(10, 10, 10, 10), units="mm")
    layout.add_viewport(
        center=(210, 148),
        size=(360, 230),
        view_center_point=(6000, 4000),
        view_height=14000,
    )
    layout.add_text(
        "图框 · A3",
        height=5,
        dxfattribs={"style": "CN", "layer": "文字"},
    ).set_placement((20, 12), align=TextEntityAlignment.LEFT)
    drop_default_layout(doc)
    doc.saveas(path)


def write_entities(path: Path) -> None:
    doc = new_doc()
    add_layers(doc)
    msp = doc.modelspace()
    msp.add_line((0, 0), (80, 40), dxfattribs={"layer": "墙"})
    msp.add_arc((40, 20), radius=18, start_angle=200, end_angle=40, dxfattribs={"layer": "门窗"})
    msp.add_circle((70, 50), 8, dxfattribs={"layer": "门窗"})
    msp.add_lwpolyline(
        [(10, 10, 0.4), (40, 10), (40, 30), (10, 30)],
        format="xyb",
        close=True,
        dxfattribs={"layer": "轴网"},
    )
    hatch = msp.add_hatch(color=3, dxfattribs={"layer": "填充"})
    hatch.paths.add_polyline_path([(50, 10), (75, 10), (75, 28), (50, 28)], is_closed=True)
    hatch.set_solid_fill()
    block = doc.blocks.new("柱")
    block.add_lwpolyline([(0, 0), (6, 0), (6, 6), (0, 6)], close=True)
    msp.add_blockref("柱", (20, 40), dxfattribs={"layer": "墙"})
    dim = msp.add_aligned_dim(p1=(0, 0), p2=(80, 40), distance=12, dimstyle="EZ_MM")
    dim.render()
    add_title(msp, "实体样例：线、弧、多段线、填充、块、标注", (0, 70), 3.5)
    paper = doc.layouts.new("布局1")
    paper.page_setup(size=(297, 210), margins=(8, 8, 8, 8), units="mm")
    paper.add_viewport(
        center=(148, 105),
        size=(250, 160),
        view_center_point=(40, 30),
        view_height=90,
    )
    drop_default_layout(doc)
    doc.saveas(path)


def write_template(path: Path) -> None:
    doc = ezdxf.new("R2010", setup=True, units=units.MM)
    doc.styles.add("CN", font="simsun.ttf")
    doc.saveas(path)


def try_dwg(dxf: Path, dwg: Path) -> bool:
    tool = shutil.which("dxf2dwg")
    if not tool:
        return False
    dwg.parent.mkdir(parents=True, exist_ok=True)
    if dwg.exists():
        dwg.unlink()
    result = subprocess.run(
        [tool, "-y", "--as", "r2000", "-o", str(dwg), str(dxf)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0 or not dwg.exists():
        print(result.stdout)
        print(result.stderr)
        return False
    return True


def main() -> None:
    DXF_DIR.mkdir(parents=True, exist_ok=True)
    DWG_DIR.mkdir(parents=True, exist_ok=True)
    TEMPLATE_DIR.mkdir(parents=True, exist_ok=True)
    files = {
        DXF_DIR / "measure-fixture.dxf": write_measure_fixture,
        DXF_DIR / "plan-zh.dxf": write_plan,
        DXF_DIR / "entities.dxf": write_entities,
    }
    for path, writer in files.items():
        writer(path)
        print(f"wrote {path.relative_to(ROOT)} ({path.stat().st_size} bytes)")
    write_template(TEMPLATE_DIR / "acadiso.dxf")
    print("wrote template acadiso.dxf")
    for dxf in (DXF_DIR / "measure-fixture.dxf", DXF_DIR / "plan-zh.dxf"):
        dwg = DWG_DIR / (dxf.stem + ".dwg")
        if try_dwg(dxf, dwg):
            print(f"wrote {dwg.relative_to(ROOT)} ({dwg.stat().st_size} bytes)")
        else:
            print(f"skipped DWG for {dxf.name} (dxf2dwg unavailable or failed)")


if __name__ == "__main__":
    main()

"""CLI entrypoint for chatdemo."""

from __future__ import annotations

from pathlib import Path

import click
from chatstyle import (CommandField, CommandSchema, add_interactive_option,
                       add_tree_option, resolve_command_inputs)

from chatdemo import __version__


@click.group(name="chatdemo", invoke_without_command=True, no_args_is_help=True)
@click.version_option(__version__, prog_name="chatdemo")
@add_tree_option(renderer_options={"root_name": "chatdemo"})
@click.option("--home", type=click.Path(path_type=Path),
              help="Directory for the local demo catalog.")
@click.pass_context
def main(ctx, home) -> None:
    """Register, serve and export static Web demonstrations."""
    ctx.ensure_object(dict)
    ctx.obj["home"] = home


@main.command("list")
@click.option("--json-output", is_flag=True, help="Print structured catalog metadata.")
@click.pass_context
def list_command(ctx, json_output):
    """List bundled and registered demonstrations."""
    import json
    from chatdemo.hosting import list_demos
    try:
        demos = list_demos(ctx.obj["home"])
    except (ValueError, OSError) as exc:
        raise click.ClickException(str(exc)) from exc
    if json_output:
        click.echo(json.dumps([demo.summary() for demo in demos], ensure_ascii=False, indent=2))
    else:
        for demo in demos:
            click.echo(f"{demo.slug}\t{demo.title}\t{demo.url_path}")


@main.command("add")
@click.argument("directory", required=False, type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option("--slug", help="Unique lowercase URL slug.")
@click.option("--title", help="Gallery title.")
@click.option("--description", default="", help="Gallery description.")
@add_interactive_option
@click.pass_context
def add_command(ctx, directory, slug, title, description, interactive):
    """Register a public asset directory containing index.html."""
    from chatdemo.hosting import add_demo
    values = resolve_command_inputs(
        schema=CommandSchema("add", fields=[
            CommandField("directory", "Public asset directory", required=True,
                         normalizer=lambda value: Path(value) if value else None),
            CommandField("slug", "URL slug", required=True),
            CommandField("title", "Gallery title", required=True),
        ]),
        provided={"directory": directory, "slug": slug, "title": title},
        interactive=interactive,
        usage="chatdemo add DIRECTORY --slug SLUG --title TITLE [-i/-I]",
    )
    try:
        demo = add_demo(**values, description=description, home=ctx.obj["home"])
    except (ValueError, OSError) as exc:
        raise click.ClickException(str(exc)) from exc
    click.echo(f"Registered {demo.slug}: {demo.url_path}")


@main.command("remove")
@click.argument("slug", required=False)
@add_interactive_option
@click.pass_context
def remove_command(ctx, slug, interactive):
    """Unregister a custom demonstration; keep its source files."""
    from chatdemo.hosting import remove_demo
    values = resolve_command_inputs(
        schema=CommandSchema("remove", fields=[CommandField("slug", "Custom demo slug", required=True)]),
        provided={"slug": slug}, interactive=interactive, usage="chatdemo remove SLUG [-i/-I]",
    )
    try:
        remove_demo(values["slug"], home=ctx.obj["home"])
    except (ValueError, OSError) as exc:
        raise click.ClickException(str(exc)) from exc
    click.echo(f"Unregistered {values['slug']}; source files preserved.")


@main.command("export")
@click.argument("destination", required=False, type=click.Path(path_type=Path))
@add_interactive_option
@click.pass_context
def export_command(ctx, destination, interactive):
    """Export a self-contained gallery into an empty directory."""
    from chatdemo.hosting import export_site
    values = resolve_command_inputs(
        schema=CommandSchema("export", fields=[CommandField(
            "destination", "Empty export destination", required=True,
            normalizer=lambda value: Path(value) if value else None)]),
        provided={"destination": destination}, interactive=interactive,
        usage="chatdemo export DESTINATION [-i/-I]",
    )
    try:
        result = export_site(values["destination"], home=ctx.obj["home"])
    except (ValueError, OSError) as exc:
        raise click.ClickException(str(exc)) from exc
    click.echo(f"Exported gallery: {result}")


@main.command("serve")
@click.option("--host", default="127.0.0.1", show_default=True,
              help="Bind address; use 0.0.0.0 explicitly for network access.")
@click.option("--port", default=8769, type=click.IntRange(0, 65535), show_default=True)
@click.pass_context
def serve_command(ctx, host, port):
    """Serve the gallery and registered assets until interrupted."""
    from chatdemo.hosting import create_server
    try:
        server = create_server(host=host, port=port, home=ctx.obj["home"])
    except (ValueError, OSError) as exc:
        raise click.ClickException(str(exc)) from exc
    click.echo(f"ChatDemo serving at http://{host}:{server.server_port}/", err=True)
    click.echo("Static demos only; no authentication. Press Ctrl+C to stop.", err=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

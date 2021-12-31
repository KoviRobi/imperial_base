{ pkgs ? import <nixpkgs> { }
}:

with pkgs;
stdenv.mkDerivation {
  name = "imperial-base";
  buildInputs = [ nodePackages.prettier ];
}

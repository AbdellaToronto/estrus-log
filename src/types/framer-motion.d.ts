// Workaround for framer-motion + React 19 type incompatibility
// See: https://github.com/motiondivision/motion/issues/3397
import "framer-motion";

declare module "framer-motion" {
  export interface MotionProps {
    children?: React.ReactNode;
  }
}

